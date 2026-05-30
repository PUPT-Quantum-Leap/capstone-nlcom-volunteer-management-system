<?php

namespace App\Http\Controllers;

use App\Enums\AuditAction;
use App\Models\AuditLog;
use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * GET /_audit
     *
     * Paginated, filterable audit log listing.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = min((int) ($request->query('per_page') ?? 15), 100);
        $logs = $this->applyFilters(AuditLog::query()->latest(), $request)->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $logs->items(),
            'pagination' => [
                'current_page' => $logs->currentPage(),
                'last_page' => $logs->lastPage(),
                'per_page' => $logs->perPage(),
                'total' => $logs->total(),
            ],
        ]);
    }

    /**
     * GET /_audit/stats
     *
     * Summary statistics for the audit log dashboard.
     */
    public function stats(): JsonResponse
    {
        $today = now()->startOfDay();

        return response()->json([
            'success' => true,
            'data' => [
                'total_today' => AuditLog::where('created_at', '>=', $today)->count(),
                'total_all' => AuditLog::count(),
                'failures_today' => AuditLog::where('created_at', '>=', $today)
                    ->where('status', 'failure')->count(),
                'critical_today' => AuditLog::where('created_at', '>=', $today)
                    ->where('severity', 'critical')->count(),
                'categories' => AuditLog::selectRaw("SUBSTRING_INDEX(action, '.', 1) as category, COUNT(*) as count")
                    ->groupBy('category')
                    ->pluck('count', 'category'),
            ],
        ]);
    }

    /**
     * GET /_audit/actions
     *
     * List all available action types for filter dropdowns.
     */
    public function actions(): JsonResponse
    {
        $actions = collect(AuditAction::cases())->map(fn (AuditAction $a) => [
            'value' => $a->value,
            'label' => $a->label(),
            'category' => $a->category(),
            'severity' => $a->severity(),
        ]);

        return response()->json(['success' => true, 'data' => $actions->values()]);
    }

    /**
     * GET /_audit/export
     *
     * Export audit logs as CSV (identical filters to index).
     */
    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        AuditLogger::log(AuditAction::AUDIT_EXPORTED, [
            'description' => 'Audit log exported to CSV',
            'resource_type' => 'audit_log',
        ]);

        $query = $this->applyFilters(AuditLog::query()->latest(), $request);
        $filename = 'audit-logs-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($query): void {
            $handle = fopen('php://output', 'w');

            fputcsv($handle, [
                'ID', 'Timestamp', 'Actor', 'Role', 'Action', 'Description',
                'Status', 'Severity', 'Resource Type', 'Resource ID',
                'Resource Label', 'Source', 'IP Address',
            ]);

            $query->chunkById(500, function ($logs) use ($handle): void {
                foreach ($logs as $log) {
                    fputcsv($handle, [
                        $log->id,
                        $log->created_at?->toIso8601String(),
                        $log->actor_name,
                        $log->actor_role,
                        $log->action instanceof AuditAction ? $log->action->value : $log->action,
                        $log->description,
                        $log->status,
                        $log->severity,
                        $log->resource_type,
                        $log->resource_id,
                        $log->resource_label,
                        $log->source,
                        $log->ip_address,
                    ]);
                }
            });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    /**
     * Apply all request filters to the given query builder.
     *
     * @param  Builder<AuditLog>  $query
     * @return Builder<AuditLog>
     */
    private function applyFilters(Builder $query, Request $request): Builder
    {
        if ($v = $request->query('category')) {
            $query->byCategory($v);
        }
        if ($v = $request->query('action')) {
            $query->where('action', $v);
        }
        if ($v = $request->query('user_id')) {
            $query->forUser((int) $v);
        }
        if ($v = $request->query('severity')) {
            $query->bySeverity($v);
        }
        if ($v = $request->query('source')) {
            $query->where('source', $v);
        }
        if ($v = $request->query('status')) {
            $query->where('status', $v);
        }
        if ($v = $request->query('resource_type')) {
            $query->where('resource_type', $v);
        }
        if ($v = $request->query('search')) {
            $query->where(function (Builder $q) use ($v): void {
                $q->where('description', 'like', "%{$v}%")
                    ->orWhere('actor_name', 'like', "%{$v}%")
                    ->orWhere('resource_label', 'like', "%{$v}%");
            });
        }

        return $query->dateRange($request->query('from'), $request->query('to'));
    }
}

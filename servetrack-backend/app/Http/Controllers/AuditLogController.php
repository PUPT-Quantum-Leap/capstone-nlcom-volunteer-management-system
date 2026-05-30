<?php

namespace App\Http\Controllers;

use App\Enums\AuditAction;
use App\Models\AuditLog;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * GET /api/admin/audit-logs
     *
     * Paginated, filterable audit log listing.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::query()->latest();

        // Filter by action category (e.g. 'auth', 'volunteer', 'rsvp')
        if ($category = $request->query('category')) {
            $query->byCategory($category);
        }

        // Filter by specific action
        if ($action = $request->query('action')) {
            $query->where('action', $action);
        }

        // Filter by user
        if ($userId = $request->query('user_id')) {
            $query->forUser((int) $userId);
        }

        // Filter by severity
        if ($severity = $request->query('severity')) {
            $query->bySeverity($severity);
        }

        // Filter by source
        if ($source = $request->query('source')) {
            $query->where('source', $source);
        }

        // Filter by status
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        // Filter by resource type
        if ($resourceType = $request->query('resource_type')) {
            $query->where('resource_type', $resourceType);
        }

        // Date range
        $query->dateRange(
            $request->query('from'),
            $request->query('to')
        );

        // Search in description or actor name
        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'like', "%{$search}%")
                    ->orWhere('actor_name', 'like', "%{$search}%")
                    ->orWhere('resource_label', 'like', "%{$search}%");
            });
        }

        $perPage = min((int) ($request->query('per_page') ?? 15), 100);
        $logs = $query->paginate($perPage);

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
     * GET /api/admin/audit-logs/stats
     *
     * Summary statistics for the audit log dashboard.
     */
    public function stats(Request $request): JsonResponse
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
                'categories' => AuditLog::selectRaw("
                    SUBSTRING_INDEX(action, '.', 1) as category,
                    COUNT(*) as count
                ")->groupBy('category')->pluck('count', 'category'),
            ],
        ]);
    }

    /**
     * GET /api/admin/audit-logs/actions
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

        return response()->json([
            'success' => true,
            'data' => $actions->values(),
        ]);
    }

    /**
     * GET /api/admin/audit-logs/export
     *
     * Export audit logs as CSV.
     */
    public function export(Request $request): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        // Audit the export itself
        AuditLogger::log(AuditAction::AUDIT_EXPORTED, [
            'description' => 'Audit log exported to CSV',
            'resource_type' => 'audit_log',
        ]);

        $query = AuditLog::query()->latest();

        // Apply same filters as index
        if ($category = $request->query('category')) {
            $query->byCategory($category);
        }
        if ($from = $request->query('from')) {
            $query->where('created_at', '>=', $from);
        }
        if ($to = $request->query('to')) {
            $query->where('created_at', '<=', $to);
        }

        $filename = 'audit-logs-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');

            // Header row
            fputcsv($handle, [
                'ID', 'Timestamp', 'Actor', 'Role', 'Action', 'Description',
                'Status', 'Severity', 'Resource Type', 'Resource ID',
                'Resource Label', 'Source', 'IP Address',
            ]);

            $query->chunk(500, function ($logs) use ($handle) {
                foreach ($logs as $log) {
                    fputcsv($handle, [
                        $log->id,
                        $log->created_at?->toIso8601String(),
                        $log->actor_name,
                        $log->actor_role,
                        $log->action?->value ?? $log->action,
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
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }
}

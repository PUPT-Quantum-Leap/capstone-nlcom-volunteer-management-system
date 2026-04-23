<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('rsvp', function (Blueprint $table) {
            $table->string('slug')->unique()->after('rsvp_id')->nullable();
            $table->index('slug');
        });

        // Backfill existing RSVPs with slugs using PHP
        $rsvps = DB::table('rsvp')->whereNull('slug')->get();
        foreach ($rsvps as $rsvp) {
            $slug = $this->generateSlug($rsvp->title, $rsvp->created_at);
            DB::table('rsvp')->where('rsvp_id', $rsvp->rsvp_id)->update(['slug' => $slug]);
        }

        // Make slug non-nullable after backfill
        Schema::table('rsvp', function (Blueprint $table) {
            $table->string('slug')->nullable(false)->change();
        });
    }

    /**
     * Generate a URL-safe slug from title and date.
     */
    private function generateSlug(string $title, string $createdAt): string
    {
        $date = \Carbon\Carbon::parse($createdAt)->format('Y-m');
        $slug = Str::slug($title).'-'.$date;

        return Str::lower($slug);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('rsvp', function (Blueprint $table) {
            $table->dropIndex(['slug']);
            $table->dropColumn('slug');
        });
    }
};

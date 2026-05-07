import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { IcsTeamFeedingOperation } from '../../services/analytics.service';
import jsPDF from 'jspdf';
import autoTable, { RowInput } from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface FeedingOperation {
  id: number;
  team: string;
  location: string;
  time: string;
  participants: number;
  details: string;
  departureNote: string;
}

interface FeedingOperationRow extends FeedingOperation {
  showTeamCell: boolean;
  teamRowSpan: number;
  isEditing?: boolean;
}

@Component({
  selector: 'app-analytics-feeding-operation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './analytics-feeding-operation.html',
  styleUrl: './analytics-feeding-operation.scss',
})
export class AnalyticsFeedingOperationComponent implements OnInit {
  private readonly analyticsService = inject(AnalyticsService);
  readonly addLocationOptionValue = '__add_new_location__';

  readonly analyticsLoading = signal(false);
  readonly operationsData = signal<FeedingOperationRow[]>([]);
  readonly teams = signal<string[]>([]);
  readonly locations = signal<string[]>([]);
  readonly saving = signal(false);

  ngOnInit(): void {
    this.loadTeams();
    this.loadOperations();
  }

  private loadTeams(): void {
    this.analyticsService.getTeams().subscribe({
      next: (teams) => this.teams.set(teams),
      error: (err) => console.error('Failed to load teams:', err),
    });
  }

  private loadOperations(): void {
    this.analyticsService.getFeedingOperations().subscribe({
      next: (data) => {
        const transformedData = this.transformApiData(data);
        this.operationsData.set(this.buildOperationsRows(transformedData));
        this.extractLocations();
      },
      error: (err) => console.error('Failed to load operations:', err),
    });
  }

  private extractLocations(): void {
    const uniqueLocations = [...new Set(this.operationsData().map((op) => op.location))];
    this.locations.set(uniqueLocations);
  }

  addNewLocation(location: string): void {
    const trimmedLocation = location.trim();
    if (trimmedLocation && !this.locations().includes(trimmedLocation)) {
      this.locations.update((locs) => [...locs, trimmedLocation]);
    }
  }

  onLocationChange(operation: FeedingOperationRow, selectedLocation: string): void {
    if (selectedLocation !== this.addLocationOptionValue) {
      operation.location = selectedLocation;
      return;
    }

    const newLocationInput = globalThis.prompt('Enter new location:');
    if (!newLocationInput) {
      this.operationsData.set([...this.operationsData()]);
      return;
    }

    const newLocation = newLocationInput.trim();
    if (!newLocation) {
      this.operationsData.set([...this.operationsData()]);
      return;
    }

    this.addNewLocation(newLocation);
    operation.location = newLocation;
    this.operationsData.set([...this.operationsData()]);
  }

  toggleEdit(operation: FeedingOperationRow): void {
    operation.isEditing = !operation.isEditing;
    this.operationsData.set([...this.operationsData()]);
  }

  saveOperation(operation: FeedingOperationRow): void {
    this.saving.set(true);
    const updatedData = {
      team: operation.team,
      location: operation.location,
      time: operation.time,
      no_of_pax: operation.participants,
      details: operation.details,
    };

    this.analyticsService.updateFeedingOperation(operation.id, updatedData).subscribe({
      next: () => {
        operation.isEditing = false;
        // Rebuild rows to maintain proper rowspan
        const currentData = this.operationsData();
        this.operationsData.set(this.buildOperationsRows(currentData));
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Failed to save:', err);
        this.saving.set(false);
      },
    });
  }

  private transformApiData(apiData: IcsTeamFeedingOperation[]): FeedingOperation[] {
    return apiData.map((item) => ({
      id: item.id,
      team: item.team,
      location: item.location || '',
      time: item.time || '',
      participants: item.no_of_pax || 0,
      details: item.details || '',
      departureNote: item.departure_note || '',
    }));
  }

  exportReport(format: 'pdf' | 'excel'): void {
    this.analyticsLoading.set(true);

    try {
      if (format === 'pdf') {
        this.exportOperationsToPdf();
      } else {
        this.exportOperationsToExcel();
      }
    } catch (error) {
      console.error(`Error exporting ${format} report:`, error);
    } finally {
      this.analyticsLoading.set(false);
    }
  }

  private buildOperationsRows(operations: FeedingOperation[]): FeedingOperationRow[] {
    // Sort operations by team to ensure proper grouping
    const sortedOps = [...operations].sort((a, b) => a.team.localeCompare(b.team));

    const teamCounts = sortedOps.reduce<Record<string, number>>((counts, operation) => {
      counts[operation.team] = (counts[operation.team] ?? 0) + 1;
      return counts;
    }, {});

    const seenTeams = new Set<string>();

    return sortedOps.map((operation) => {
      const isFirstTeamOccurrence = !seenTeams.has(operation.team);
      if (isFirstTeamOccurrence) {
        seenTeams.add(operation.team);
      }

      return {
        ...operation,
        showTeamCell: isFirstTeamOccurrence,
        teamRowSpan: teamCounts[operation.team] ?? 1,
        isEditing: false,
      };
    });
  }

  private getGroupedOperations(): Array<{
    team: string;
    departureNote: string;
    operations: FeedingOperationRow[];
  }> {
    const teams: Array<{
      team: string;
      departureNote: string;
      operations: FeedingOperationRow[];
    }> = [];

    let currentTeam: string | null = null;
    let teamGroup: FeedingOperationRow[] = [];
    let departureNote = '';
    const data = this.operationsData();

    for (const op of data) {
      if (op.team !== currentTeam) {
        if (teamGroup.length > 0) {
          teams.push({
            team: currentTeam!,
            departureNote,
            operations: teamGroup,
          });
        }
        currentTeam = op.team;
        departureNote = op.departureNote;
        teamGroup = [op];
      } else {
        teamGroup.push(op);
      }
    }

    if (teamGroup.length > 0) {
      teams.push({
        team: currentTeam!,
        departureNote,
        operations: teamGroup,
      });
    }

    return teams;
  }

  private exportOperationsToPdf(): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `feeding-operation-report-${timestamp}.pdf`;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const teams = this.getGroupedOperations();
    const tableRows: RowInput[] = [];
    let itemNumber = 1;
    let totalPax = 0;

    for (const team of teams) {
      for (let idx = 0; idx < team.operations.length; idx += 1) {
        const op = team.operations[idx];
        const row: any[] = [];

        if (idx === 0) {
          row.push({
            content: `${team.team}\n${team.departureNote}`,
            rowSpan: team.operations.length,
            styles: {
              fontStyle: 'bold',
              fillColor: [249, 250, 251],
              halign: 'center',
              valign: 'middle',
            },
          });
        }

        row.push(`${itemNumber}. ${op.location}`, op.time, op.participants.toString(), op.details);
        tableRows.push(row as RowInput);
        totalPax += op.participants;
        itemNumber += 1;
      }
    }

    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('NLCOM x Metro World Child Feeding Operation', 40, 38);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('November 22, 2025', 40, 54);

    autoTable(pdf, {
      startY: 68,
      theme: 'grid',
      head: [['Team & Time Departure', 'Location', 'Time', 'No. of Pax', 'Details']],
      body: tableRows,
      styles: {
        font: 'helvetica',
        fontSize: 8.2,
        cellPadding: 4,
        lineColor: [0, 0, 0],
        lineWidth: 0.5,
        textColor: [0, 0, 0],
        valign: 'top',
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [243, 244, 246],
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 140 },
        1: { cellWidth: 115 },
        2: { cellWidth: 90, halign: 'center' },
        3: { cellWidth: 55, halign: 'center' },
        4: { cellWidth: 140 },
      },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.halign = 'center';
        }
      },
    });

    const finalY = (pdf as any).lastAutoTable.finalY + 18;
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`TOTAL PAX: ${totalPax}`, 40, finalY);

    pdf.save(filename);
  }

  private exportOperationsToExcel(): void {
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `feeding-operation-report-${timestamp}.xlsx`;
    const sheetRows: (string | number)[][] = [
      ['NLCOM x Metro World Child Feeding Operation'],
      ['November 22, 2025'],
      ['Team & Time Departure', 'Location', 'Time', 'No. of Pax', 'Details'],
    ];

    const merges: XLSX.Range[] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];

    const teams = this.getGroupedOperations();
    const teamRanges: Array<{ start: number; end: number }> = [];
    const paxRows: number[] = [];
    let itemNumber = 1;
    let currentRowIndex = 3;
    let totalPax = 0;

    for (const team of teams) {
      const teamStartRow = currentRowIndex;

      for (const op of team.operations) {
        sheetRows.push([
          currentRowIndex === teamStartRow ? `${team.team}\n${team.departureNote}` : '',
          `${itemNumber}. ${op.location}`,
          op.time,
          op.participants,
          op.details,
        ]);

        paxRows.push(currentRowIndex);
        totalPax += op.participants;
        itemNumber += 1;
        currentRowIndex += 1;
      }

      teamRanges.push({ start: teamStartRow, end: currentRowIndex - 1 });
      if (team.operations.length > 1) {
        merges.push({ s: { r: teamStartRow, c: 0 }, e: { r: currentRowIndex - 1, c: 0 } });
      }
    }

    const totalRowIndex = currentRowIndex;
    sheetRows.push(['', '', 'TOTAL PAX', totalPax, '']);

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet['!merges'] = merges;
    worksheet['!cols'] = [{ wch: 32 }, { wch: 24 }, { wch: 16 }, { wch: 10 }, { wch: 62 }];

    const border = {
      top: { style: 'thin' as const, color: { rgb: '000000' } },
      right: { style: 'thin' as const, color: { rgb: '000000' } },
      bottom: { style: 'thin' as const, color: { rgb: '000000' } },
      left: { style: 'thin' as const, color: { rgb: '000000' } },
    };

    const titleStyle = {
      font: { bold: true, sz: 14, name: 'Calibri' },
      alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    };
    const dateStyle = {
      font: { sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'left' as const, vertical: 'center' as const },
    };
    const headerStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: 'F3F4F6' } },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
      border,
    };
    const baseCellStyle = {
      font: { sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true },
      border,
    };
    const teamCellStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      fill: { fgColor: { rgb: 'F9FAFB' } },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
      border,
    };
    const paxCellStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const },
      border,
    };
    const totalLabelStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'right' as const, vertical: 'center' as const },
      border,
    };
    const totalValueStyle = {
      font: { bold: true, sz: 10, name: 'Calibri' },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const },
      border,
    };

    const applyStyle = (row: number, col: number, style: Record<string, unknown>): void => {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      if (!worksheet[ref]) {
        worksheet[ref] = { t: 's', v: '' };
      }
      Object.assign(worksheet[ref], { s: style });
    };

    applyStyle(0, 0, titleStyle);
    applyStyle(1, 0, dateStyle);

    for (let col = 0; col < 5; col += 1) {
      applyStyle(2, col, headerStyle);
    }

    for (let row = 3; row <= totalRowIndex; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        applyStyle(row, col, baseCellStyle);
      }
    }

    for (const range of teamRanges) {
      for (let row = range.start; row <= range.end; row += 1) {
        applyStyle(row, 0, teamCellStyle);
      }
    }

    for (const row of paxRows) {
      applyStyle(row, 3, paxCellStyle);
    }

    applyStyle(totalRowIndex, 2, totalLabelStyle);
    applyStyle(totalRowIndex, 3, totalValueStyle);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Feeding Operation');

    const fileBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([fileBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    this.analyticsService.downloadFile(blob, filename);
  }
}

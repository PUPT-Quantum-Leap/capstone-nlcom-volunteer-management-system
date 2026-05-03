import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
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
}

interface FeedingOperationRow extends FeedingOperation {
  showTeamCell: boolean;
  teamRowSpan: number;
  departureNote: string;
}

@Component({
  selector: 'app-analytics-feeding-operation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink],
  templateUrl: './analytics-feeding-operation.html',
  styleUrl: './analytics-feeding-operation.scss',
})
export class AnalyticsFeedingOperationComponent {
  private readonly analyticsService = inject(AnalyticsService);

  private readonly teamDepartureNotes: Record<string, string> = {
    'TEAM ALPHA': 'NL Las Pinas Leaves base at 7:30am',
    'TEAM BRAVO': 'Tondo AM Leave base at 7:30am',
    'TEAM CHARLIE': 'GIAWH AM Leaves base at 8:30am',
    'TEAM DELTA': 'GIAWH PM Leaves base at 2:00pm',
    'TEAM ECHO': 'Tondo PM Leaves base at 2:00pm',
    'TEAM FOXTROT': 'NL Muntinlupa Leaves New Life at 2:00pm',
  };

  readonly analyticsLoading = signal(false);
  readonly operationsData: FeedingOperationRow[] = this.buildOperationsRows([
    {
      id: 1,
      team: 'TEAM ALPHA',
      location: 'Golden Acres (Talon 1)',
      time: '8:00am - 9:30am',
      participants: 100,
      details:
        'Team Alpha: drop off GA team before proceeding to VP. GA team to wait after feeding for pick up.',
    },
    {
      id: 2,
      team: 'TEAM ALPHA',
      location: 'Villa Pangarap (Talon 5)',
      time: '8:00am - 9:30am',
      participants: 150,
      details:
        'Team Alpha: Park vehicle in VP. After feeding, pick up GA team and go directly to Annex.',
    },
    {
      id: 3,
      team: 'TEAM ALPHA',
      location: 'Annex (Talon 5)',
      time: '09:00am-12:00n',
      participants: 150,
      details:
        'Team Alpha: Whole team will proceed to Annex after the 2 sites before heading back to base.',
    },
    {
      id: 4,
      team: 'TEAM BRAVO',
      location: 'Market 3',
      time: '8:30am - 10:00am',
      participants: 200,
      details:
        'Team Bravo: Whole team to proceed to M3 until feeding. The same team will be going to the second site (NBBN) after M3 before heading back to base.',
    },
    {
      id: 5,
      team: 'TEAM BRAVO',
      location: 'NBBN',
      time: '11:00am - 12:30pm',
      participants: 170,
      details: 'Team Bravo: NBBN site operations',
    },
    {
      id: 6,
      team: 'TEAM CHARLIE',
      location: 'Masville',
      time: '09:00am-12:00nn',
      participants: 350,
      details: 'Team Charlie1: whole team to proceed to Masville',
    },
    {
      id: 7,
      team: 'TEAM CHARLIE',
      location: 'Banal',
      time: '09:00am-10:30am',
      participants: 250,
      details: 'Team Charlie2: whole team to proceed to Banal',
    },
    {
      id: 8,
      team: 'TEAM DELTA',
      location: 'Sitio Pagkakaisa Zone',
      time: '2:00pm-3:30pm',
      participants: 300,
      details: 'Team Delta1: whole team to transport food via pedicab to reach Sitio Pagkakaisa',
    },
    {
      id: 9,
      team: 'TEAM DELTA',
      location: 'Sucat Highway',
      time: '3:30pm-4:30pm',
      participants: 300,
      details: 'Team Delta2: whole team to proceed to Sucat Highway',
    },
    {
      id: 10,
      team: 'TEAM ECHO',
      location: 'Delpan',
      time: '3:30pm-4:30pm',
      participants: 220,
      details: 'Team Echo: whole team to proceed to Delpan',
    },
    {
      id: 11,
      team: 'TEAM FOXTROT',
      location: 'Paraiso (Alabang)',
      time: '2:00pm - 4:00pm',
      participants: 100,
      details:
        'Team Foxtrot: drop off Paraiso team before proceeding to Sunrise. Paraiso to wait after feeding for pick up',
    },
    {
      id: 12,
      team: 'TEAM FOXTROT',
      location: 'Sunrise (Bayananan)',
      time: '2:00pm - 4:00pm',
      participants: 100,
      details:
        'Team Foxtrot: Park vehicle in Sunrise. After feeding, pick up Paraiso team and head back to base.',
    },
  ]);

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
    const teamCounts = operations.reduce<Record<string, number>>((counts, operation) => {
      counts[operation.team] = (counts[operation.team] ?? 0) + 1;
      return counts;
    }, {});

    const seenTeams = new Set<string>();

    return operations.map((operation) => {
      const isFirstTeamOccurrence = !seenTeams.has(operation.team);
      if (isFirstTeamOccurrence) {
        seenTeams.add(operation.team);
      }

      return {
        ...operation,
        showTeamCell: isFirstTeamOccurrence,
        teamRowSpan: teamCounts[operation.team] ?? 1,
        departureNote: this.teamDepartureNotes[operation.team] ?? '',
      };
    });
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
      didParseCell: (hookData) => {
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

    for (const op of this.operationsData) {
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

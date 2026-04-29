    public function exportExcel(Request $request): Response
    {
        $role = $request->user()?->role;
        if ($role !== 'admin') {
            return response()->json([
                'success' => false,
                'message' => 'Forbidden. Admin access only.',
            ], 403);
        }

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Feeding Operation');

        // Set default font to Calibri
        $spreadsheet->getDefaultStyle()->getFont()->setName('Calibri');

        // Title - 15pt Bold
        $sheet->setCellValue('A1', 'NLCOM x Metro World Child Feeding Operation');
        $sheet->mergeCells('A1:E1');
        $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(15);
        $sheet->getStyle('A1')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        // Date - 11pt Regular
        $sheet->setCellValue('A2', 'November 22, 2025');
        $sheet->mergeCells('A2:E2');
        $sheet->getStyle('A2')->getFont()->setSize(11);
        $sheet->getStyle('A2')->getAlignment()->setHorizontal(\PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER);

        // Headers - 10pt Bold
        $sheet->setCellValue('A4', 'TEAM & TIME DEPARTURE');
        $sheet->setCellValue('B4', 'LOCATION');
        $sheet->setCellValue('C4', 'TIME');
        $sheet->setCellValue('D4', 'NO. OF PAX');
        $sheet->setCellValue('E4', 'DETAILS');

        $sheet->getStyle('A4:E4')->getFont()->setBold(true)->setSize(10);
        $sheet->getStyle('A4:E4')->getFill()->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)->getStartColor()->setARGB('FFe5e7eb');

        // Data - 10pt Regular
        $row = 5;

        // Team Alpha
        $sheet->setCellValue('A'.$row, 'TEAM ALPHA (NL Las Piñas - Leaves 7:30am)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '1. Golden Acres (Talon 1)');
        $sheet->setCellValue('B'.$row, 'Golden Acres (Talon 1)');
        $sheet->setCellValue('C'.$row, '8:00am - 9:30am');
        $sheet->setCellValue('D'.$row, 100);
        $sheet->setCellValue('E'.$row, 'Drop off GA team before proceeding to VP. Wait after feeding.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '2. Villa Pangarap (Talon 5)');
        $sheet->setCellValue('B'.$row, 'Villa Pangarap (Talon 5)');
        $sheet->setCellValue('C'.$row, '8:00am - 9:30am');
        $sheet->setCellValue('D'.$row, 150);
        $sheet->setCellValue('E'.$row, 'Park vehicle in VP. After feeding, pick up GA team and go to Annex.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '3. Annex (Talon 5)');
        $sheet->setCellValue('B'.$row, 'Annex (Talon 5)');
        $sheet->setCellValue('C'.$row, '9:00am - 12:00nn');
        $sheet->setCellValue('D'.$row, 150);
        $sheet->setCellValue('E'.$row, 'Proceed after 2 sites before heading back to base.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Bravo
        $sheet->setCellValue('A'.$row, 'TEAM BRAVO (Tondo AM - Leaves 7:30am)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '4. Market 3');
        $sheet->setCellValue('B'.$row, 'Market 3');
        $sheet->setCellValue('C'.$row, '8:30am - 10:00am');
        $sheet->setCellValue('D'.$row, 200);
        $sheet->setCellValue('E'.$row, 'Proceed to M3 until feeding. Then go to second site (NBBN).');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '5. NBBN');
        $sheet->setCellValue('B'.$row, 'NBBN');
        $sheet->setCellValue('C'.$row, '11:00am - 12:30pm');
        $sheet->setCellValue('D'.$row, 170);
        $sheet->setCellValue('E'.$row, 'Continue after M3 before heading back to base.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Charlie
        $sheet->setCellValue('A'.$row, 'TEAM CHARLIE (GIAWH AM - Leaves 8:30am)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '6. Masville');
        $sheet->setCellValue('B'.$row, 'Masville');
        $sheet->setCellValue('C'.$row, '9:00am - 12:00nn');
        $sheet->setCellValue('D'.$row, 350);
        $sheet->setCellValue('E'.$row, 'Whole team proceeds to Masville.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '7. Banai');
        $sheet->setCellValue('B'.$row, 'Banai');
        $sheet->setCellValue('C'.$row, '9:00am - 10:30am');
        $sheet->setCellValue('D'.$row, 250);
        $sheet->setCellValue('E'.$row, 'Whole team proceeds to Banai.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Delta
        $sheet->setCellValue('A'.$row, 'TEAM DELTA (GIAWH PM - Leaves 2:00pm)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '8. Sitio Pagkakaisa Zone');
        $sheet->setCellValue('B'.$row, 'Sitio Pagkakaisa Zone');
        $sheet->setCellValue('C'.$row, '2:00pm - 3:30pm');
        $sheet->setCellValue('D'.$row, 300);
        $sheet->setCellValue('E'.$row, 'Transport food via pedicab to reach Sitio Pagkakaisa.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '9. Sucat Highway');
        $sheet->setCellValue('B'.$row, 'Sucat Highway');
        $sheet->setCellValue('C'.$row, '3:30pm - 4:30pm');
        $sheet->setCellValue('D'.$row, 300);
        $sheet->setCellValue('E'.$row, 'Whole team proceeds to Sucat Highway.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Echo
        $sheet->setCellValue('A'.$row, 'TEAM ECHO (Tondo PM - Leaves 2:00pm)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '10. Delpan');
        $sheet->setCellValue('B'.$row, 'Delpan');
        $sheet->setCellValue('C'.$row, '3:30pm - 4:30pm');
        $sheet->setCellValue('D'.$row, 220);
        $sheet->setCellValue('E'.$row, 'Whole team proceeds to Delpan.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row += 2;

        // Team Foxtrot
        $sheet->setCellValue('A'.$row, 'TEAM FOXTROT (NL Muntinlupa - Leaves 2:00pm)');
        $sheet->mergeCells("A{$row}:E{$row}");
        $sheet->getStyle("A{$row}")->getFont()->setBold(true)->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '11. Paraiso (Alabang)');
        $sheet->setCellValue('B'.$row, 'Paraiso (Alabang)');
        $sheet->setCellValue('C'.$row, '2:00pm - 4:00pm');
        $sheet->setCellValue('D'.$row, 100);
        $sheet->setCellValue('E'.$row, 'Drop off Paraiso team before proceeding to Sunrise.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        $sheet->setCellValue('A'.$row, '12. Sunrise (Bayanan)');
        $sheet->setCellValue('B'.$row, 'Sunrise (Bayanan)');
        $sheet->setCellValue('C'.$row, '2:00pm - 4:00pm');
        $sheet->setCellValue('D'.$row, 100);
        $sheet->setCellValue('E'.$row, 'Park vehicle. After feeding, pick up Paraiso team and return.');
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setSize(10);
        $row++;

        // Total PAX - 10pt Bold
        $row++;
        $sheet->setCellValue('A'.$row, 'TOTAL PAX:');
        $sheet->mergeCells("B{$row}:C{$row}");
        $sheet->setCellValue('D'.$row, 2390);
        $sheet->getStyle("A{$row}:E{$row}")->getFont()->setBold(true)->setSize(10);

        // Borders
        $sheet->getStyle("A4:E{$row}")->getBorders()->getAllBorders()->setBorderStyle(\PhpOffice\PhpSpreadsheet\Style\Border::BORDER_THIN);

        foreach (range('A', 'E') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
        $filename = 'nlcom-metro-world-child-feeding-'.date('Y-m-d-H-i-s').'.xlsx';

        ob_start();
        $writer->save('php://output');
        $content = ob_get_clean();

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

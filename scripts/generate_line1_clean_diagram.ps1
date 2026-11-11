Add-Type -AssemblyName System.Drawing

function GenerateLine1CleanDiagram($outputPath) {
    $width = 1024
    $height = 240
    $bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

    # 1. Nền tổng thể: Gradient từ trắng xám sang xám nhạt nhà xưởng
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 0)),
        (New-Object System.Drawing.Point(0, $height)),
        [System.Drawing.Color]::FromArgb(248, 250, 252),
        [System.Drawing.Color]::FromArgb(226, 232, 240)
    )
    $g.FillRectangle($bgBrush, 0, 0, $width, $height)
    $bgBrush.Dispose()

    # 2. Sàn epoxy phối cảnh 2.5D công nghiệp
    $floorBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0, 130)),
        (New-Object System.Drawing.Point(0, $height)),
        [System.Drawing.Color]::FromArgb(235, 239, 245),
        [System.Drawing.Color]::FromArgb(203, 213, 225)
    )
    [System.Drawing.Point[]]$floorPoints = @(
        (New-Object System.Drawing.Point(10, 145)),
        (New-Object System.Drawing.Point(1014, 145)),
        (New-Object System.Drawing.Point(1014, 232)),
        (New-Object System.Drawing.Point(10, 232))
    )
    $g.FillPolygon($floorBrush, $floorPoints)
    $floorBrush.Dispose()

    # 3. Vạch kẻ an toàn 5S màu vàng (Safety Yellow)
    $yellowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(245, 158, 11), 3)
    $g.DrawLine($yellowPen, 15, 148, 1009, 148)
    $g.DrawLine($yellowPen, 15, 228, 1009, 228)
    $g.DrawLine($yellowPen, 15, 148, 15, 228)
    $g.DrawLine($yellowPen, 1009, 148, 1009, 228)
    $yellowPen.Dispose()

    # 4. Băng tải con lăn thép (Roller Conveyor) chạy ngang
    $conveyorY = 168
    $conveyorH = 18
    # Khung ray băng tải
    $railBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
    $g.FillRectangle($railBrush, 55, $conveyorY, 915, $conveyorH)
    $railBrush.Dispose()

    # Chân đế băng tải
    $legBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(100, 116, 139))
    for ($lx = 75; $lx -lt 955; $lx += 70) {
        $g.FillRectangle($legBrush, $lx, $conveyorY + $conveyorH, 8, 38)
        $g.FillRectangle($legBrush, ($lx - 4), ($conveyorY + $conveyorH + 34), 16, 4)
    }
    $legBrush.Dispose()

    # Các con lăn thép tròn
    $rollerBrush2 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(241, 245, 249))
    $rollerPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(71, 85, 105), 1)
    for ($rx = 58; $rx -lt 965; $rx += 12) {
        $g.FillRectangle($rollerBrush2, $rx, ($conveyorY + 2), 7, ($conveyorH - 4))
        $g.DrawRectangle($rollerPen, $rx, ($conveyorY + 2), 7, ($conveyorH - 4))
    }
    $rollerBrush2.Dispose()
    $rollerPen.Dispose()

    # 5. Mũi tên hướng dòng chảy sản xuất (Flow Arrows) màu xanh
    $arrowPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(59, 130, 246), 2.5)
    $arrowXs = @(100, 240, 378, 512, 648, 792, 925)
    foreach ($ax in $arrowXs) {
        $g.DrawLine($arrowPen, $ax, 216, ($ax + 7), 220)
        $g.DrawLine($arrowPen, ($ax + 7), 220, $ax, 224)
        $g.DrawLine($arrowPen, ($ax + 6), 216, ($ax + 13), 220)
        $g.DrawLine($arrowPen, ($ax + 13), 220, ($ax + 6), 224)
    }
    $arrowPen.Dispose()

    # 6. Bục ĐẦU VÀO (Bên trái)
    $inletRect = New-Object System.Drawing.Rectangle(15, 142, 45, 42)
    $blueBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(29, 78, 216))
    $bluePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(30, 64, 175), 1.5)
    $g.FillRectangle($blueBrush, $inletRect)
    $g.DrawRectangle($bluePen, $inletRect)
    
    $lblFont = New-Object System.Drawing.Font("Segoe UI", 7.5, [System.Drawing.FontStyle]::Bold)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $g.DrawString("ĐẦU`nVÀO →", $lblFont, $whiteBrush, [System.Drawing.RectangleF]::op_Implicit($inletRect), $sf)

    # 7. Bục ĐẦU RA (Bên phải)
    $outletRect = New-Object System.Drawing.Rectangle(964, 142, 45, 42)
    $g.FillRectangle($blueBrush, $outletRect)
    $g.DrawRectangle($bluePen, $outletRect)
    $g.DrawString("ĐẦU`nRA →", $lblFont, $whiteBrush, [System.Drawing.RectangleF]::op_Implicit($outletRect), $sf)

    $blueBrush.Dispose()
    $bluePen.Dispose()
    $lblFont.Dispose()
    $whiteBrush.Dispose()
    $sf.Dispose()

    # 8. Danh sách 6 máy Line 1 (LN-PRS-01)
    # Vị trí tâm x khớp chính xác với STATION_PERCENT_X:
    # OP10: 16.2% -> 166
    # OP20: 30.5% -> 312
    # OP30: 43.5% -> 445
    # OP40: 56.5% -> 579
    # OP50: 70.0% -> 717
    # OP60: 84.5% -> 865
    $centers = @(166, 312, 445, 579, 717, 865)
    $machines = @(
        @{ file = "MC-ASM-01.png"; customH = 132 },
        @{ file = "MC-CYL-01.png"; customH = 136 },
        @{ file = "MC-FDR-01.png"; customH = 126 },
        @{ file = "MC-PHASE-C.png"; customH = 126 },
        @{ file = "STP-01.png"; customH = 144 },
        @{ file = "ROB-01.png"; customH = 128 }
    )

    for ($i = 0; $i -lt 6; $i++) {
        $mPath = "public/images/machines/" + $machines[$i].file
        if (Test-Path $mPath) {
            $mImg = [System.Drawing.Image]::FromFile((Resolve-Path $mPath).Path)
            
            $targetH = $machines[$i].customH
            $aspect = $mImg.Width / $mImg.Height
            $targetW = [int]($targetH * $aspect)

            $drawX = [int]($centers[$i] - ($targetW / 2))
            $drawY = [int](210 - $targetH)

            # Drop shadow
            $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 15, 23, 42))
            $g.FillEllipse($shadowBrush, ($drawX + 6), 204, ($targetW - 12), 12)
            $shadowBrush.Dispose()

            # Vẽ ảnh máy chân thực, sắc nét
            $g.DrawImage($mImg, $drawX, $drawY, $targetW, $targetH)

            # Cột đèn Andon 3 màu đặc trưng DENSO trên đỉnh máy
            $andonX = $drawX + $targetW - 12
            $andonY = $drawY - 14
            if ($andonY -lt 40) { $andonY = 40 }
            
            $poleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(148, 163, 184))
            $g.FillRectangle($poleBrush, ($andonX + 3), ($andonY + 12), 3, 14)
            $poleBrush.Dispose()
            
            $redB = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(239, 68, 68))
            $g.FillRectangle($redB, $andonX, $andonY, 8, 4)
            $redB.Dispose()
            
            $yelB = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(245, 158, 11))
            $g.FillRectangle($yelB, $andonX, ($andonY + 4), 8, 4)
            $yelB.Dispose()
            
            $grnB = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 185, 129))
            $g.FillRectangle($grnB, $andonX, ($andonY + 8), 8, 4)
            $grnB.Dispose()

            $mImg.Dispose()
        }
    }

    $g.Dispose()
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $bmp.Dispose()
    Write-Host "Created clean Line 1 diagram successfully: $outputPath"
}

# Sinh file trực tiếp vào public/images/lines/line1-diagram-body.jpg và dist nếu có
GenerateLine1CleanDiagram "public/images/lines/line1-diagram-body.jpg"
if (Test-Path "dist/images/lines") {
    Copy-Item -Force "public/images/lines/line1-diagram-body.jpg" "dist/images/lines/line1-diagram-body.jpg"
}

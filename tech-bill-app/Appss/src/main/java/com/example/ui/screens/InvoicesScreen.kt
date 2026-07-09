package com.example.ui.screens

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import android.net.Uri
import android.os.Environment
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.Icon
import androidx.compose.material.Text
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Share
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import com.example.ui.theme.*
import com.example.ui.viewmodel.Invoice
import com.example.ui.viewmodel.InvoiceStatus
import com.example.ui.viewmodel.SaaSViewModel
import java.io.File
import java.io.FileOutputStream
import java.text.NumberFormat
import java.util.*

import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun InvoicesScreen(
    viewModel: SaaSViewModel,
    onInvoiceClick: (Invoice) -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val uiState by viewModel.invoiceLedgerState.collectAsStateWithLifecycle()
    val invoices by viewModel.invoiceStream.collectAsStateWithLifecycle(initialValue = emptyList())

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DeepSpaceDark)
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Header Zone
            Column {
                Text(
                    text = "TRANSACTION LEDGER",
                    color = NeonCyan,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "Invoices & Receipts",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black
                )
            }

            // 1. FROSTED SEARCH FIELD
            FrostedSearchField(
                query = uiState.searchQuery,
                onQueryChange = { query ->
                    viewModel.updateSearchQuery(query)
                }
            )

            // 2. LAZY LIST RENDER
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (invoices.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(40.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "No invoices matching query.",
                                color = Color.White.copy(alpha = 0.4f),
                                fontSize = 13.sp
                            )
                        }
                    }
                } else {
                    items(invoices.size, key = { index -> invoices[index].id }) { index ->
                        InvoiceCard(
                            invoice = invoices[index],
                            onClick = { onInvoiceClick(invoices[index]) }
                        )
                    }
                }
            }

            // 3. EXPORT CONTROLS: Native PDF compiling & Android Share Sheet Integration
            ExportTriggerControls(
                isExporting = uiState.isExporting,
                onExportPdf = {
                    viewModel.setExportingState(true)
                    compilePdfDocument(context, invoices) { file ->
                        viewModel.setExportingState(false)
                        if (file != null) {
                            Toast.makeText(context, "PDF saved to: ${file.name}", Toast.LENGTH_LONG).show()
                        } else {
                            Toast.makeText(context, "PDF compilation failed", Toast.LENGTH_SHORT).show()
                        }
                    }
                },
                onShareSheet = {
                    compilePdfDocument(context, invoices) { file ->
                        if (file != null) {
                            sharePdfFile(context, file)
                        } else {
                            Toast.makeText(context, "No PDF compile to share", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            )
        }
    }
}

@Composable
private fun FrostedSearchField(
    query: String,
    onQueryChange: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .antigravityGlass(cornerRadius = 14.dp)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Search,
                contentDescription = "Search Lens",
                tint = NeonCyan,
                modifier = Modifier.size(20.dp)
            )

            Box(modifier = Modifier.weight(1f)) {
                if (query.isEmpty()) {
                    Text(
                        text = "Search Client Ref ID or Phone...",
                        color = Color.White.copy(alpha = 0.35f),
                        fontSize = 14.sp
                    )
                }
                BasicTextField(
                    value = query,
                    onValueChange = onQueryChange,
                    textStyle = TextStyle(
                        color = Color.White,
                        fontSize = 14.sp,
                        fontFamily = FontFamily.SansSerif
                    ),
                    cursorBrush = SolidColor(NeonCyan),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun InvoiceCard(
    invoice: Invoice,
    onClick: () -> Unit
) {
    val isPaid = invoice.status == InvoiceStatus.Paid

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .antigravityGlass(cornerRadius = 16.dp)
            .elasticClickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(
            verticalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.weight(1f)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text(
                    text = invoice.clientName,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp
                )
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color.White.copy(alpha = 0.08f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = invoice.clientReferenceId,
                        color = NeonCyan,
                        fontSize = 9.sp,
                        fontFamily = FontFamily.Monospace
                    )
                }
            }

            Text(
                text = "Phone: ${invoice.clientPhone} • ${invoice.date}",
                color = Color.White.copy(alpha = 0.5f),
                fontSize = 11.sp
            )
        }

        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Text(
                text = NumberFormat.getCurrencyInstance(Locale.US).format(invoice.amount),
                color = Color.White,
                fontWeight = FontWeight.Black,
                fontFamily = FontFamily.Monospace,
                fontSize = 16.sp
            )

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(
                        if (isPaid) ElectricGreen.copy(alpha = 0.08f) else ElectricRed.copy(alpha = 0.08f)
                    )
                    .border(
                        width = 1.dp,
                        color = if (isPaid) ElectricGreen.copy(alpha = 0.3f) else ElectricRed.copy(alpha = 0.3f),
                        shape = RoundedCornerShape(8.dp)
                    )
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            ) {
                Icon(
                    imageVector = if (isPaid) Icons.Default.CheckCircle else Icons.Default.Info,
                    contentDescription = invoice.status.name,
                    tint = if (isPaid) ElectricGreen else ElectricRed,
                    modifier = Modifier.size(10.dp)
                )
                Text(
                    text = invoice.status.name.uppercase(Locale.getDefault()),
                    color = if (isPaid) ElectricGreen else ElectricRed,
                    fontSize = 9.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}

@Composable
private fun ExportTriggerControls(
    isExporting: Boolean,
    onExportPdf: () -> Unit,
    onShareSheet: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Box(
            modifier = Modifier
                .weight(1f)
                .antigravityGlass(cornerRadius = 14.dp)
                .elasticClickable(onClick = onExportPdf)
                .padding(vertical = 14.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = if (isExporting) "COMPILING PDF..." else "EXPORT PDF",
                color = NeonCyan,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                letterSpacing = 1.sp
            )
        }

        Box(
            modifier = Modifier
                .weight(1f)
                .antigravityGlass(cornerRadius = 14.dp)
                .elasticClickable(onClick = onShareSheet)
                .padding(vertical = 14.dp),
            contentAlignment = Alignment.Center
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Share,
                    contentDescription = "Share",
                    tint = NeonPurple,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "SHARE LEDGER",
                    color = NeonPurple,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp,
                    letterSpacing = 1.sp
                )
            }
        }
    }
}

// ==========================================
// 🛠️ NATIVE OS INTEGRATION WORKERS
// ==========================================

private fun compilePdfDocument(
    context: Context,
    invoices: List<Invoice>,
    onComplete: (File?) -> Unit
) {
    val pdfDocument = PdfDocument()
    val pageInfo = PdfDocument.PageInfo.Builder(595, 842, 1).create() // A4 Size
    val page = pdfDocument.startPage(pageInfo)
    val canvas = page.canvas
    val paint = Paint()

    // Title
    paint.textSize = 20f
    paint.isFakeBoldText = true
    canvas.drawText("TechBill Ledger Export", 40f, 60f, paint)

    // Subtitle
    paint.textSize = 12f
    paint.isFakeBoldText = false
    canvas.drawText("Compiled on ${Date()}", 40f, 90f, paint)

    // Items list
    var yPos = 140f
    paint.textSize = 10f
    for (invoice in invoices.take(20)) { // Limit page output for safety
        canvas.drawText(
            "${invoice.clientName} (${invoice.clientReferenceId}) - ${invoice.amount} USD - Status: ${invoice.status}",
            40f,
            yPos,
            paint
        )
        yPos += 25f
    }

    pdfDocument.finishPage(page)

    // Save PDF file locally with rigorous storage and permission error check
    var outputStream: FileOutputStream? = null
    try {
        val file = File(context.cacheDir, "techbill_ledger_${System.currentTimeMillis()}.pdf")
        outputStream = FileOutputStream(file)
        pdfDocument.writeTo(outputStream)
        pdfDocument.close()
        outputStream.close()
        onComplete(file)
    } catch (e: java.io.IOException) {
        e.printStackTrace()
        // Display toast error notification for I/O and storage exceptions
        Toast.makeText(context, "Ledger export failed: Storage full or write denied.", Toast.LENGTH_LONG).show()
        onComplete(null)
    } catch (e: Exception) {
        e.printStackTrace()
        Toast.makeText(context, "Ledger compilation error.", Toast.LENGTH_SHORT).show()
        onComplete(null)
    } finally {
        try {
            outputStream?.close()
        } catch (ignored: Exception) {}
    }
}

private fun sharePdfFile(context: Context, file: File) {
    val uri = FileProvider.getUriForFile(
        context,
        "${context.packageName}.provider",
        file
    )
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "application/pdf"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "Share TechBill Invoice Ledger"))
}

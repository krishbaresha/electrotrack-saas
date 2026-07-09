package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

@Composable
fun RevenueChart(
    modifier: Modifier = Modifier
) {
    val revenueData = listOf(12000f, 18000f, 15000f, 22000f, 19000f, 24000f, 25000f)
    val days = listOf("Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed")

    Card(
        colors = CardDefaults.cardColors(
            containerColor = DarkSurface
        ),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = "REVENUE TRENDS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = DarkTextSecondary,
                        letterSpacing = 1.sp
                    )
                    Text(
                        text = "Revenue — Last 7 Days",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
                Text(
                    text = "Rs 25,000 max",
                    fontSize = 12.sp,
                    color = AccentCyan,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Canvas drawing
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
            ) {
                Canvas(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 8.dp)
                ) {
                    val width = size.width
                    val height = size.height

                    val maxVal = 30000f
                    val stepX = width / (revenueData.size - 1)

                    // Draw Horizontal dashed grid lines
                    val gridLines = 4
                    val gridStepY = height / gridLines
                    for (i in 0..gridLines) {
                        val y = i * gridStepY
                        drawLine(
                            color = DarkBorder.copy(alpha = 0.4f),
                            start = Offset(0f, y),
                            end = Offset(width, y),
                            strokeWidth = 1.dp.toPx()
                        )
                    }

                    // Build line chart path
                    val path = Path()
                    val fillPath = Path()

                    revenueData.forEachIndexed { index, value ->
                        val x = index * stepX
                        val y = height - (value / maxVal) * height

                        if (index == 0) {
                            path.moveTo(x, y)
                            fillPath.moveTo(x, height)
                            fillPath.lineTo(x, y)
                        } else {
                            path.lineTo(x, y)
                            fillPath.lineTo(x, y)
                        }

                        if (index == revenueData.size - 1) {
                            fillPath.lineTo(x, height)
                            fillPath.close()
                        }
                    }

                    // Draw area gradient shading
                    drawPath(
                        path = fillPath,
                        brush = Brush.verticalGradient(
                            colors = listOf(AccentCyan.copy(alpha = 0.25f), Color.Transparent)
                        )
                    )

                    // Draw connecting line
                    drawPath(
                        path = path,
                        color = AccentCyan,
                        style = Stroke(
                            width = 2.dp.toPx(),
                            cap = StrokeCap.Round
                        )
                    )

                    // Draw interactive glow points
                    revenueData.forEachIndexed { index, value ->
                        val x = index * stepX
                        val y = height - (value / maxVal) * height

                        // Inner circle point
                        drawCircle(
                            color = AccentCyan,
                            radius = 4.dp.toPx(),
                            center = Offset(x, y)
                        )

                        // Outer glowing border on the peak point
                        if (index == revenueData.size - 1) {
                            drawCircle(
                                color = AccentCyan.copy(alpha = 0.4f),
                                radius = 8.dp.toPx(),
                                center = Offset(x, y)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // X-Axis Labels row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                days.forEachIndexed { index, day ->
                    Text(
                        text = day,
                        color = if (index == days.size - 1) AccentCyan else DarkTextSecondary,
                        fontSize = 11.sp,
                        fontWeight = if (index == days.size - 1) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.width(36.dp),
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

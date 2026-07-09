package com.example.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*

@Composable
fun AiInsightsCard(
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = DarkSurface
        ),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
            .fillMaxWidth()
            .border(
                width = 1.dp,
                brush = Brush.horizontalGradient(
                    colors = listOf(AccentCyan.copy(alpha = 0.4f), Color.Transparent)
                ),
                shape = RoundedCornerShape(16.dp)
            )
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(18.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.AutoAwesome,
                    contentDescription = "AI Sparkles",
                    tint = AccentCyan,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "AI INSIGHTS & REAL-TIME ANALYTICS",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    color = AccentCyan,
                    letterSpacing = 1.sp
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Insight Bullet 1
            InsightBulletItem(
                text = "Revenue is holding strong at Rs 25,000 today with offline trade generating 100% of the active volume."
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Insight Bullet 2
            InsightBulletItem(
                text = "Online selling channels are synced; currently waiting on courier ledgers to clear COD cash pools."
            )
            Spacer(modifier = Modifier.height(8.dp))

            // Insight Bullet 3
            InsightBulletItem(
                text = "Critical Inventory Alert: 2 mobile and headphone units are at 0 or 1 left. Consider restocking."
            )
        }
    }
}

@Composable
private fun InsightBulletItem(
    text: String,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.Top
    ) {
        Text(
            text = "✦",
            color = AccentCyan,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(top = 1.dp)
        )
        Text(
            text = text,
            color = DarkTextPrimary,
            fontSize = 13.sp,
            lineHeight = 18.sp
        )
    }
}

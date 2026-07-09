package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Block
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.ui.viewmodel.SaaSViewModel

@Composable
fun OnlineOrdersScreen(
    viewModel: SaaSViewModel,
    modifier: Modifier = Modifier
) {
    val onlineSellingEnabled by viewModel.onlineSellingEnabled.collectAsState()
    val onlineSales by viewModel.onlineSales.collectAsState()
    val isLoading by viewModel.onlineSalesLoading.collectAsState()

    var activeTab by remember { mutableStateOf("Pending") }
    val tabs = listOf("Pending", "Dispatched", "Completed", "Returned")

    if (!onlineSellingEnabled) {
        // Fallback illustration when onlineSellingEnabled === false
        Box(
            modifier = modifier
                .fillMaxSize()
                .background(DarkBgStart)
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
                modifier = Modifier.fillMaxWidth(0.85f)
            ) {
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(RoundedCornerShape(24.dp))
                        .background(DarkSurface)
                        .border(1.dp, DarkBorder, RoundedCornerShape(24.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Block,
                        contentDescription = "Disabled Channel",
                        tint = AccentAmber,
                        modifier = Modifier.size(40.dp)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "E-Commerce Channel Offline",
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Your business tenant does not have active e-commerce integrations enabled. Please upgrade your core plan to sync courier ledger pipelines.",
                    fontSize = 13.sp,
                    color = DarkTextSecondary,
                    textAlign = TextAlign.Center,
                    lineHeight = 19.sp
                )
            }
        }
    } else {
        // Main Online Orders Interface
        val currentTabSales = remember(onlineSales, activeTab) {
            onlineSales.filter { sale ->
                sale.courierStatus?.equals(activeTab, ignoreCase = true) == true
            }
        }

        // Dynamically compute highlights
        val codDeliveredValue = remember(onlineSales) {
            onlineSales.filter { it.courierStatus?.equals("Completed", ignoreCase = true) == true }
                .sumOf { it.totalAmount }
        }

        val totalPayoutsLogged = remember(onlineSales) {
            onlineSales.filter { it.payoutStatus?.equals("Logged", ignoreCase = true) == true || it.payoutStatus?.equals("Cleared", ignoreCase = true) == true }
                .sumOf { it.totalAmount }
        }

        val dueFromCouriers = remember(onlineSales) {
            onlineSales.filter { it.payoutStatus?.equals("Due", ignoreCase = true) == true }
                .sumOf { it.totalAmount }
        }

        Column(
            modifier = modifier
                .fillMaxSize()
                .background(DarkBgStart)
                .padding(horizontal = 16.dp)
        ) {
            Spacer(modifier = Modifier.height(20.dp))

            // Screen title
            Text(
                text = "Online Commerce",
                fontSize = 24.sp,
                fontWeight = FontWeight.Bold,
                color = Color.White
            )
            Text(
                text = "Track active courier ledgers and payout status.",
                fontSize = 13.sp,
                color = DarkTextSecondary,
                modifier = Modifier.padding(top = 2.dp, bottom = 20.dp)
            )

            // Top highlights summary cards
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                OnlineHighlightCard(
                    title = "Delivered COD",
                    value = "Rs ${formatAmount(codDeliveredValue)}",
                    accentColor = AccentGreen,
                    modifier = Modifier.weight(1f)
                )
                OnlineHighlightCard(
                    title = "Payouts Logged",
                    value = "Rs ${formatAmount(totalPayoutsLogged)}",
                    accentColor = AccentCyan,
                    modifier = Modifier.weight(1f)
                )
                OnlineHighlightCard(
                    title = "Due from Couriers",
                    value = "Rs ${formatAmount(dueFromCouriers)}",
                    accentColor = AccentAmber,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Segmented Sub-Tab Selection Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(DarkSurface)
                    .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
                    .padding(4.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                tabs.forEach { tabName ->
                    val isSelected = activeTab == tabName
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (isSelected) AccentCyan.copy(alpha = 0.15f) else Color.Transparent)
                            .clickable { activeTab = tabName }
                            .padding(vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = tabName,
                            color = if (isSelected) AccentCyan else DarkTextSecondary,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            fontSize = 12.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(18.dp))

            // Orders list
            if (isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AccentCyan)
                }
            } else if (currentTabSales.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            imageVector = Icons.Default.ShoppingBag,
                            contentDescription = "Empty tab",
                            tint = DarkBorder,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "No $activeTab orders synced.",
                            color = DarkTextSecondary,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            } else {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 16.dp)
                ) {
                    items(currentTabSales) { sale ->
                        OnlineCourierItemCard(sale = sale)
                    }
                }
            }
        }
    }
}

@Composable
fun OnlineHighlightCard(
    title: String,
    value: String,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = DarkSurface
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier.border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
    ) {
        Column(
            modifier = Modifier.padding(12.dp)
        ) {
            Text(
                text = title,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                color = DarkTextSecondary,
                maxLines = 1
            )
            Spacer(modifier = Modifier.height(6.dp))
            Text(
                text = value,
                fontSize = 13.sp,
                color = accentColor,
                fontWeight = FontWeight.Bold,
                maxLines = 1
            )
        }
    }
}

@Composable
fun OnlineCourierItemCard(
    sale: com.example.data.model.SaleItem,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(
            containerColor = DarkSurface
        ),
        shape = RoundedCornerShape(14.dp),
        modifier = modifier.border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
    ) {
        Column(
            modifier = Modifier.padding(14.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text = sale.id,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 14.sp
                    )
                    Text(
                        text = "Courier: Leopards Cod • ID: ${sale.id}",
                        color = DarkTextSecondary,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }

                // Subtitle/Status Pills
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(
                            when (sale.payoutStatus?.lowercase()) {
                                "logged", "cleared" -> AccentGreen.copy(alpha = 0.12f)
                                "due" -> AccentAmber.copy(alpha = 0.12f)
                                else -> DarkBorder
                            }
                        )
                        .border(
                            1.dp,
                            when (sale.payoutStatus?.lowercase()) {
                                "logged", "cleared" -> AccentGreen.copy(alpha = 0.4f)
                                "due" -> AccentAmber.copy(alpha = 0.4f)
                                else -> DarkBorder
                            },
                            RoundedCornerShape(6.dp)
                        )
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Payout: ${sale.payoutStatus ?: "N/A"}",
                        color = when (sale.payoutStatus?.lowercase()) {
                            "logged", "cleared" -> AccentGreen
                            "due" -> AccentAmber
                            else -> DarkTextSecondary
                        },
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Divider(color = DarkBorder.copy(alpha = 0.3f))

            Spacer(modifier = Modifier.height(10.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column {
                    Text(
                        text = "Receiver: ${sale.customerName ?: "E-Commerce Buyer"}",
                        color = Color.White,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "COD Value: Rs ${formatAmount(sale.codValue ?: 0.0)}",
                        color = DarkTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }

                Text(
                    text = "Rs ${formatAmount(sale.totalAmount)}",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = AccentCyan
                )
            }
        }
    }
}

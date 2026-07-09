package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.spring
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.ui.viewmodel.SaaSViewModel
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun InvoicesScreen(
    viewModel: SaaSViewModel,
    modifier: Modifier = Modifier
) {
    val sales by viewModel.recentSales.collectAsState()
    val isLoading by viewModel.salesLoading.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()

    var activeExpandedInvoiceId by remember { mutableStateOf<String?>(null) }
    var triggerSearchQuery by remember { mutableStateOf("") }

    val filteredSales = remember(sales, triggerSearchQuery) {
        if (triggerSearchQuery.isEmpty()) {
            sales
        } else {
            sales.filter { sale ->
                sale.id.contains(triggerSearchQuery, ignoreCase = true) ||
                        (sale.customerName?.contains(triggerSearchQuery, ignoreCase = true) == true)
            }
        }
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
            text = "Invoices Database",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Text(
            text = "Overview of active and completed client receipts.",
            fontSize = 13.sp,
            color = DarkTextSecondary,
            modifier = Modifier.padding(top = 2.dp, bottom = 20.dp)
        )

        // Custom Styled Search Bar + adjoining stylized button
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = searchQuery,
                onValueChange = { viewModel.searchQuery.value = it },
                placeholder = { Text("Search Invoice ID, client...", color = DarkTextSecondary) },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = "Search Icon",
                        tint = DarkTextSecondary
                    )
                },
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = AccentCyan,
                    unfocusedBorderColor = DarkBorder,
                    focusedTextColor = Color.White,
                    unfocusedTextColor = Color.White,
                    focusedContainerColor = DarkSurface,
                    unfocusedContainerColor = DarkSurface
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.weight(1f),
                singleLine = true
            )

            Button(
                onClick = { triggerSearchQuery = searchQuery },
                colors = ButtonDefaults.buttonColors(
                    containerColor = AccentCyan,
                    contentColor = DarkBgStart
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.height(56.dp)
            ) {
                Text(
                    text = "Search",
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        if (isLoading) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = AccentCyan)
            }
        } else if (filteredSales.isEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        imageVector = Icons.Default.ReceiptLong,
                        contentDescription = "Empty",
                        tint = DarkBorder,
                        modifier = Modifier.size(64.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = "No matching invoices found",
                        color = DarkTextSecondary,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        } else {
            LazyColumn(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp),
                contentPadding = PaddingValues(bottom = 16.dp)
            ) {
                items(filteredSales) { sale ->
                    InvoiceListItemCard(
                        sale = sale,
                        isExpanded = activeExpandedInvoiceId == sale.id,
                        onToggleExpand = {
                            activeExpandedInvoiceId = if (activeExpandedInvoiceId == sale.id) null else sale.id
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun InvoiceListItemCard(
    sale: com.example.data.model.SaleItem,
    isExpanded: Boolean,
    onToggleExpand: () -> Unit,
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
                color = if (isExpanded) AccentCyan.copy(alpha = 0.5f) else DarkBorder,
                shape = RoundedCornerShape(16.dp)
            )
            .clickable { onToggleExpand() }
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            // ID & Status Badge Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = sale.id,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    fontSize = 15.sp
                )

                // Completed Status Badge
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(AccentGreen.copy(alpha = 0.12f))
                        .border(1.dp, AccentGreen.copy(alpha = 0.4f), RoundedCornerShape(6.dp))
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        text = "Completed",
                        color = AccentGreen,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Time & Total Price Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Bottom
            ) {
                Column {
                    Text(
                        text = "Customer: ${sale.customerName ?: "Walk-in Client"}",
                        color = DarkTextPrimary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        text = "Type: ${sale.customerType ?: "Retail"} • Pay: ${sale.paymentType ?: "Cash"}",
                        color = DarkTextSecondary,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                    Text(
                        text = formatIsoDateTime(sale.createdAt),
                        color = DarkTextSecondary,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }

                Text(
                    text = "Rs ${formatAmount(sale.totalAmount)}",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.Bold,
                    color = AccentCyan
                )
            }

            // Expandable inline drawer
            AnimatedVisibility(
                visible = isExpanded,
                enter = expandVertically(animationSpec = spring()),
                exit = shrinkVertically(animationSpec = spring())
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp)
                        .border(1.dp, DarkBorder, RoundedCornerShape(8.dp))
                        .background(DarkBgStart.copy(alpha = 0.5f))
                        .padding(14.dp)
                ) {
                    Text(
                        text = "ITEMIZED TRANSACTION DETAILS",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = DarkTextSecondary,
                        letterSpacing = 1.sp
                    )

                    Spacer(modifier = Modifier.height(8.dp))

                    if (sale.items.isNullOrEmpty()) {
                        Text(
                            text = "No item warranty records synced with this receipt.",
                            color = DarkTextSecondary,
                            fontSize = 12.sp
                        )
                    } else {
                        sale.items.forEachIndexed { idx, item ->
                            Column(modifier = Modifier.padding(vertical = 4.dp)) {
                                Text(
                                    text = "${idx + 1}. Brand: ${item.brand ?: "Generic"}",
                                    color = Color.White,
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = "Serial: ${item.serialNumber ?: "N/A"}",
                                    color = DarkTextSecondary,
                                    fontSize = 12.sp
                                )
                                Text(
                                    text = "Warranty: ${item.warrantyStart ?: "N/A"} to ${item.warrantyEnd ?: "N/A"}",
                                    color = DarkTextSecondary,
                                    fontSize = 12.sp
                                )
                            }
                            if (idx < sale.items.size - 1) {
                                Divider(
                                    color = DarkBorder.copy(alpha = 0.4f),
                                    modifier = Modifier.padding(vertical = 6.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Inactive View Receipt button
                    Button(
                        onClick = { /* Inactive action */ },
                        colors = ButtonDefaults.buttonColors(
                            containerColor = DarkBorder,
                            contentColor = DarkTextSecondary
                        ),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth(),
                        enabled = false
                    ) {
                        Text(
                            text = "View Receipt (Read Only)",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

fun formatAmount(amount: Double): String {
    return try {
        String.format(Locale.US, "%,.0f", amount)
    } catch (e: Exception) {
        amount.toString()
    }
}

fun formatIsoDateTime(isoStr: String): String {
    return try {
        val cleanStr = isoStr.replace("Z", "+0000")
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssZ", Locale.ROOT)
        val date = parser.parse(cleanStr) ?: return isoStr
        val formatter = SimpleDateFormat("dd MMM yyyy, hh:mm a", Locale.ROOT)
        formatter.format(date)
    } catch (e: Exception) {
        isoStr
    }
}

package com.example.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.data.model.*
import com.example.ui.theme.*
import com.example.ui.viewmodel.SaaSViewModel
import java.text.NumberFormat
import java.util.*

// ─── Bottom Nav Tabs ──────────────────────────────────────────────────────────

private enum class DashTab(val label: String, val icon: ImageVector) {
    OVERVIEW("Overview", Icons.Default.Dashboard),
    INVOICES("Invoices", Icons.Default.Receipt),
    ONLINE("Online", Icons.Default.ShoppingBag),
    PROFILE("Profile", Icons.Default.Person)
}

// ─── Root Screen ──────────────────────────────────────────────────────────────

@Composable
fun DashboardScreen(viewModel: SaaSViewModel) {
    val currentUserName     by viewModel.userName.collectAsStateWithLifecycle()
    val userRole            by viewModel.userRole.collectAsStateWithLifecycle()
    val salesSummary        by viewModel.salesSummary.collectAsStateWithLifecycle()
    val lowStockItems       by viewModel.lowStockItems.collectAsStateWithLifecycle()
    val recentSales         by viewModel.recentSales.collectAsStateWithLifecycle()
    val onlineSales         by viewModel.onlineSales.collectAsStateWithLifecycle()
    val pushNotifications   by viewModel.pushNotificationsEnabled.collectAsStateWithLifecycle()
    val onlineSelling       by viewModel.onlineSellingEnabled.collectAsStateWithLifecycle()
    val isSyncing           by viewModel.isSyncing.collectAsStateWithLifecycle()
    val tenants             by viewModel.tenants.collectAsStateWithLifecycle()

    var selectedTab by remember { mutableStateOf(DashTab.OVERVIEW) }

    Scaffold(
        containerColor = DarkBgStart,
        topBar = {
            DashboardTopBar(
                userName = currentUserName ?: "…",
                isSyncing = isSyncing,
                onRefresh = { viewModel.triggerSync() }
            )
        },
        bottomBar = {
            DashboardBottomNav(
                selectedTab = selectedTab,
                onTabSelected = { selectedTab = it }
            )
        }
    ) { paddingValues ->
        AnimatedContent(
            targetState = selectedTab,
            transitionSpec = {
                (slideInHorizontally { it } + fadeIn()).togetherWith(
                    slideOutHorizontally { -it } + fadeOut()
                )
            },
            label = "DashboardTabContent"
        ) { tab ->
            when (tab) {
                DashTab.OVERVIEW -> OverviewTab(
                    role = userRole,
                    salesSummary = salesSummary,
                    lowStockItems = lowStockItems,
                    recentSales = recentSales,
                    tenants = tenants,
                    modifier = Modifier.padding(paddingValues)
                )
                DashTab.INVOICES -> InvoicesTab(
                    sales = recentSales,
                    modifier = Modifier.padding(paddingValues)
                )
                DashTab.ONLINE -> OnlineOrdersTab(
                    sales = onlineSales,
                    isEnabled = onlineSelling,
                    modifier = Modifier.padding(paddingValues)
                )
                DashTab.PROFILE -> ProfileTab(
                    viewModel = viewModel,
                    pushNotifications = pushNotifications,
                    modifier = Modifier.padding(paddingValues)
                )
            }
        }
    }
}

// ─── Top App Bar ──────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DashboardTopBar(
    userName: String,
    isSyncing: Boolean,
    onRefresh: () -> Unit
) {
    TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = DarkBgStart,
            titleContentColor = Color.White
        ),
        title = {
            Column {
                Text(
                    text = userName,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "TechBill Console",
                    fontSize = 12.sp,
                    color = DarkTextSecondary
                )
            }
        },
        actions = {
            if (isSyncing) {
                CircularProgressIndicator(
                    modifier = Modifier
                        .size(20.dp)
                        .padding(end = 12.dp),
                    color = AccentCyan,
                    strokeWidth = 2.dp
                )
            } else {
                IconButton(onClick = onRefresh) {
                    Icon(
                        imageVector = Icons.Default.Refresh,
                        contentDescription = "Refresh data",
                        tint = AccentCyan
                    )
                }
            }
        }
    )
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

@Composable
private fun DashboardBottomNav(
    selectedTab: DashTab,
    onTabSelected: (DashTab) -> Unit
) {
    NavigationBar(
        containerColor = DarkSurface,
        tonalElevation = 0.dp,
        modifier = Modifier.border(
            width = 1.dp,
            color = DarkBorder,
            shape = RoundedCornerShape(topStart = 16.dp, topEnd = 16.dp)
        )
    ) {
        DashTab.entries.forEach { tab ->
            val selected = tab == selectedTab
            NavigationBarItem(
                selected = selected,
                onClick = { onTabSelected(tab) },
                icon = {
                    Icon(
                        imageVector = tab.icon,
                        contentDescription = tab.label,
                        modifier = Modifier.size(22.dp)
                    )
                },
                label = {
                    Text(
                        text = tab.label,
                        fontSize = 11.sp
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    selectedIconColor = AccentCyan,
                    selectedTextColor = AccentCyan,
                    unselectedIconColor = DarkTextSecondary,
                    unselectedTextColor = DarkTextSecondary,
                    indicatorColor = AccentCyan.copy(alpha = 0.12f)
                )
            )
        }
    }
}

// ─── Overview Tab — RBAC gated ────────────────────────────────────────────────

@Composable
private fun OverviewTab(
    role: String?,
    salesSummary: SalesSummary?,
    lowStockItems: List<InventoryItem>,
    recentSales: List<SaleItem>,
    tenants: List<TenantModel>,
    modifier: Modifier = Modifier
) {
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBgStart)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        when (role) {
            "platform_admin" -> {
                item { PlatformAdminMetricsGrid() }
                if (tenants.isNotEmpty()) {
                    item {
                        SectionLabel("TENANT REGISTRY")
                    }
                    items(tenants) { tenant ->
                        TenantRow(tenant = tenant)
                    }
                }
            }
            "cashier" -> {
                // Cashiers see only transaction & item counts — no revenue or profit
                item { SectionLabel("ACTIVITY OVERVIEW") }
                if (salesSummary != null) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            MetricCard(
                                label = "Transactions",
                                value = "${salesSummary.transactionCount}",
                                icon = Icons.Default.ReceiptLong,
                                accentColor = AccentCyan,
                                modifier = Modifier.weight(1f)
                            )
                            MetricCard(
                                label = "Items Sold",
                                value = "${salesSummary.itemsSold}",
                                icon = Icons.Default.Inventory2,
                                accentColor = AccentGreen,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
                if (lowStockItems.isNotEmpty()) {
                    item { SectionLabel("LOW STOCK ALERTS") }
                    items(lowStockItems) { item ->
                        LowStockRow(item = item)
                    }
                }
            }
            else -> {
                // owner / merchant — full financial metrics
                item { SectionLabel("SALES OVERVIEW") }
                if (salesSummary != null) {
                    item { OwnerMetricsGrid(salesSummary) }
                } else {
                    item {
                        EmptyStateCard(
                            message = "No sales data yet.\nStart recording transactions to see your metrics.",
                            icon = Icons.Default.ShowChart
                        )
                    }
                }

                if (lowStockItems.isNotEmpty()) {
                    item { SectionLabel("LOW STOCK ALERTS") }
                    items(lowStockItems.take(5)) { item ->
                        LowStockRow(item = item)
                    }
                }

                if (recentSales.isNotEmpty()) {
                    item { SectionLabel("RECENT TRANSACTIONS") }
                    items(recentSales.take(8)) { sale ->
                        SaleRow(sale = sale)
                    }
                }
            }
        }
    }
}

// ─── Metric Grids ─────────────────────────────────────────────────────────────

@Composable
private fun OwnerMetricsGrid(summary: SalesSummary) {
    val pkrFormat = NumberFormat.getCurrencyInstance(Locale("ur", "PK")).apply {
        maximumFractionDigits = 0
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            MetricCard(
                label = "Total Revenue",
                value = pkrFormat.format(summary.totalRevenue),
                icon = Icons.Default.AttachMoney,
                accentColor = AccentCyan,
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                label = "Net Profit",
                value = pkrFormat.format(summary.totalNetProfit),
                icon = Icons.Default.TrendingUp,
                accentColor = AccentGreen,
                modifier = Modifier.weight(1f)
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            MetricCard(
                label = "Transactions",
                value = "${summary.transactionCount}",
                icon = Icons.Default.ReceiptLong,
                accentColor = AccentAmber,
                modifier = Modifier.weight(1f)
            )
            MetricCard(
                label = "Items Sold",
                value = "${summary.itemsSold}",
                icon = Icons.Default.Inventory2,
                accentColor = AccentRed,
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun PlatformAdminMetricsGrid() {
    SectionLabel("PLATFORM TELEMETRY")
    Spacer(modifier = Modifier.height(4.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        MetricCard(
            label = "CPU Load",
            value = "—",
            icon = Icons.Default.Memory,
            accentColor = AccentCyan,
            modifier = Modifier.weight(1f)
        )
        MetricCard(
            label = "Memory",
            value = "—",
            icon = Icons.Default.Storage,
            accentColor = AccentAmber,
            modifier = Modifier.weight(1f)
        )
    }
    Spacer(modifier = Modifier.height(10.dp))
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        MetricCard(
            label = "WS Rooms",
            value = "—",
            icon = Icons.Default.Hub,
            accentColor = AccentGreen,
            modifier = Modifier.weight(1f)
        )
        MetricCard(
            label = "Active Users",
            value = "—",
            icon = Icons.Default.People,
            accentColor = AccentRed,
            modifier = Modifier.weight(1f)
        )
    }
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

@Composable
private fun MetricCard(
    label: String,
    value: String,
    icon: ImageVector,
    accentColor: Color,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier
            .border(1.dp, DarkBorder, RoundedCornerShape(14.dp)),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = DarkSurface)
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(accentColor.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = accentColor,
                    modifier = Modifier.size(18.dp)
                )
            }
            Text(
                text = value,
                fontSize = 20.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White
            )
            Text(
                text = label,
                fontSize = 11.sp,
                color = DarkTextSecondary,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

// ─── Invoices Tab ─────────────────────────────────────────────────────────────

@Composable
private fun InvoicesTab(
    sales: List<SaleItem>,
    modifier: Modifier = Modifier
) {
    if (sales.isEmpty()) {
        EmptyStateFull(
            message = "No invoices found.",
            icon = Icons.Default.Receipt,
            modifier = modifier
        )
        return
    }
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBgStart)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        item { SectionLabel("ALL INVOICES") }
        items(sales) { sale ->
            SaleRow(sale = sale)
        }
    }
}

// ─── Online Orders Tab ────────────────────────────────────────────────────────

@Composable
private fun OnlineOrdersTab(
    sales: List<SaleItem>,
    isEnabled: Boolean,
    modifier: Modifier = Modifier
) {
    if (!isEnabled) {
        EmptyStateFull(
            message = "Online selling is not enabled\nfor your account.",
            icon = Icons.Default.ShoppingBag,
            modifier = modifier
        )
        return
    }
    if (sales.isEmpty()) {
        EmptyStateFull(
            message = "No online orders yet.",
            icon = Icons.Default.ShoppingBag,
            modifier = modifier
        )
        return
    }
    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBgStart)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        item { SectionLabel("ONLINE ORDERS") }
        items(sales) { sale ->
            SaleRow(sale = sale)
        }
    }
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

@Composable
private fun ProfileTab(
    viewModel: SaaSViewModel,
    pushNotifications: Boolean,
    modifier: Modifier = Modifier
) {
    val userName     by viewModel.userName.collectAsStateWithLifecycle()
    val userEmail    by viewModel.userEmail.collectAsStateWithLifecycle()
    val userRole     by viewModel.userRole.collectAsStateWithLifecycle()
    val periodEnd    by viewModel.currentPeriodEnd.collectAsStateWithLifecycle()

    LazyColumn(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBgStart)
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(vertical = 16.dp)
    ) {
        item {
            Text(
                text = "PROFILE",
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color.White
            )
            Text(
                text = "Console configuration and account settings.",
                fontSize = 13.sp,
                color = DarkTextSecondary,
                modifier = Modifier.padding(top = 2.dp)
            )
        }

        // ── User profile card ─────────────────────────────────────────────────
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(AccentCyan.copy(alpha = 0.12f))
                            .border(1.dp, AccentCyan.copy(alpha = 0.4f), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Person,
                            contentDescription = "Avatar",
                            tint = AccentCyan,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                    Column {
                        Text(
                            text = userName ?: "Guest User",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color.White
                        )
                        Text(
                            text = userEmail ?: "—",
                            fontSize = 13.sp,
                            color = DarkTextSecondary
                        )
                        if (!userRole.isNullOrBlank()) {
                            Spacer(modifier = Modifier.height(4.dp))
                            Surface(
                                color = AccentCyan.copy(alpha = 0.12f),
                                shape = RoundedCornerShape(20.dp)
                            ) {
                                Text(
                                    text = userRole!!.replace("_", " ").uppercase(),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = AccentCyan,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp)
                                )
                            }
                        }
                    }
                }

                if (!periodEnd.isNullOrBlank()) {
                    HorizontalDivider(color = DarkBorder)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 18.dp, vertical = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Subscription End",
                            fontSize = 12.sp,
                            color = DarkTextSecondary
                        )
                        Text(
                            text = periodEnd!!.take(10),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold,
                            color = AccentAmber
                        )
                    }
                }
            }
        }

        // ── Push notification toggle ──────────────────────────────────────────
        item {
            SectionLabel("SYSTEM SETTINGS")
            Spacer(modifier = Modifier.height(8.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            imageVector = Icons.Default.Notifications,
                            contentDescription = "Push notifications",
                            tint = AccentCyan,
                            modifier = Modifier.size(22.dp)
                        )
                        Column {
                            Text(
                                text = "Sales Alert Pushes",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Text(
                                text = "Receive instant heads-up alerts",
                                fontSize = 12.sp,
                                color = DarkTextSecondary
                            )
                        }
                    }
                    Switch(
                        checked = pushNotifications,
                        onCheckedChange = { viewModel.togglePushNotifications(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = DarkBgStart,
                            checkedTrackColor = AccentCyan,
                            uncheckedThumbColor = DarkTextSecondary,
                            uncheckedTrackColor = DarkBorder
                        )
                    )
                }
            }
        }

        // ── Logout button ─────────────────────────────────────────────────────
        item {
            Spacer(modifier = Modifier.height(8.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = DarkSurface),
                shape = RoundedCornerShape(14.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
                    .clickable { viewModel.logout() }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Logout,
                        contentDescription = "Sign Out",
                        tint = AccentRed,
                        modifier = Modifier.size(22.dp)
                    )
                    Text(
                        text = "Sign Out from Console",
                        color = AccentRed,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

// ─── Shared Composables ───────────────────────────────────────────────────────

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        color = DarkTextSecondary,
        letterSpacing = 1.5.sp
    )
}

@Composable
private fun LowStockRow(item: InventoryItem) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(AccentAmber.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Warning,
                        contentDescription = null,
                        tint = AccentAmber,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Column {
                    Text(
                        text = item.name,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium,
                        color = Color.White
                    )
                    Text(
                        text = item.sku ?: "—",
                        fontSize = 11.sp,
                        color = DarkTextSecondary
                    )
                }
            }
            Surface(
                color = AccentAmber.copy(alpha = 0.15f),
                shape = RoundedCornerShape(20.dp)
            ) {
                Text(
                    text = "${item.quantity} left",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = AccentAmber,
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                )
            }
        }
    }
}

@Composable
private fun SaleRow(sale: SaleItem) {
    val pkrFormat = NumberFormat.getCurrencyInstance(Locale("ur", "PK")).apply {
        maximumFractionDigits = 0
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = sale.customerName ?: "Walk-in Customer",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = Color.White
                )
                Text(
                    text = sale.createdAt.take(10),
                    fontSize = 11.sp,
                    color = DarkTextSecondary
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = pkrFormat.format(sale.totalAmount),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = AccentCyan
                )
                Text(
                    text = sale.paymentType ?: "—",
                    fontSize = 11.sp,
                    color = DarkTextSecondary
                )
            }
        }
    }
}

@Composable
private fun TenantRow(tenant: TenantModel) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = tenant.name,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Text(
                    text = "@${tenant.slug}",
                    fontSize = 11.sp,
                    color = DarkTextSecondary
                )
            }
            Surface(
                color = when (tenant.status.lowercase()) {
                    "active" -> AccentGreen.copy(alpha = 0.15f)
                    else     -> AccentAmber.copy(alpha = 0.15f)
                },
                shape = RoundedCornerShape(20.dp)
            ) {
                Text(
                    text = tenant.status.uppercase(),
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = when (tenant.status.lowercase()) {
                        "active" -> AccentGreen
                        else     -> AccentAmber
                    },
                    modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
                )
            }
        }
    }
}

@Composable
private fun EmptyStateCard(
    message: String,
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = DarkSurface),
        shape = RoundedCornerShape(16.dp),
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, DarkBorder, RoundedCornerShape(16.dp))
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = DarkTextSecondary,
                modifier = Modifier.size(40.dp)
            )
            Text(
                text = message,
                fontSize = 13.sp,
                color = DarkTextSecondary,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
private fun EmptyStateFull(
    message: String,
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBgStart),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = DarkTextSecondary,
                modifier = Modifier.size(48.dp)
            )
            Text(
                text = message,
                fontSize = 14.sp,
                color = DarkTextSecondary,
                textAlign = TextAlign.Center
            )
        }
    }
}

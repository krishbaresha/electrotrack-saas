package com.example.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.example.ui.viewmodel.DashboardViewModel

// ─── Nav item data class ──────────────────────────────────────────────────────

private data class DashboardNavItem(
    val label: String,
    val icon: ImageVector,
    val selectedIcon: ImageVector = icon,
)

// ─── Dashboard screen ─────────────────────────────────────────────────────────

/**
 * DashboardScreen — main owner hub for TechBill mobile.
 *
 * ## Dynamic RBAC Warehouse Gating
 * The [isWarehouseEnabled] parameter is sourced from [TenantConfigViewModel]
 * in the parent [AppNavigation]. When false:
 *   - The "Warehouse" bottom-nav tab is completely removed from the tab list.
 *   - The warehouse tab's content pane is never composed or retained in memory.
 *   - [onNavigateToWarehouse] is never called.
 *
 * This is a runtime, reactive gate — if a Super Admin toggles the flag remotely,
 * [TenantConfigViewModel] will emit a new value, and this screen will recompose
 * and hide/show the tab without requiring re-login.
 *
 * @param isWarehouseEnabled    Reactive flag from tenant config API.
 * @param onNavigateToReturns   Navigate to the returns list screen.
 * @param onNavigateToWarehouse Navigate to the warehouse screen (only called when enabled).
 * @param onLogout              Trigger session clear and navigate back to login.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    isWarehouseEnabled: Boolean,
    onNavigateToReturns: () -> Unit,
    onNavigateToWarehouse: () -> Unit,
    onLogout: () -> Unit,
    viewModel: DashboardViewModel = hiltViewModel(),
) {
    // ── Build tab list dynamically ────────────────────────────────────────────

    val baseNavItems = remember {
        listOf(
            DashboardNavItem(
                label = "Overview",
                icon = Icons.Default.Home,
                selectedIcon = Icons.Filled.Home,
            ),
            DashboardNavItem(
                label = "Returns",
                icon = Icons.Default.AssignmentReturn,
                selectedIcon = Icons.Filled.AssignmentReturn,
            ),
        )
    }

    val warehouseNavItem = DashboardNavItem(
        label = "Warehouse",
        icon = Icons.Default.Warehouse,
        selectedIcon = Icons.Filled.Warehouse,
    )

    // Compose final visible tab list — warehouse only appears when entitled
    val navItems = remember(isWarehouseEnabled) {
        if (isWarehouseEnabled) baseNavItems + warehouseNavItem else baseNavItems
    }

    var selectedTabIndex by remember { mutableIntStateOf(0) }

    // Guard: if tab count shrinks (warehouse toggled off), clamp selection
    LaunchedEffect(navItems.size) {
        if (selectedTabIndex >= navItems.size) {
            selectedTabIndex = 0
        }
    }

    val salesSummary by viewModel.salesSummary.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("TechBill") },
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.Logout, contentDescription = "Logout")
                    }
                },
            )
        },
        bottomBar = {
            NavigationBar {
                navItems.forEachIndexed { index, item ->
                    NavigationBarItem(
                        selected = selectedTabIndex == index,
                        onClick = {
                            selectedTabIndex = index
                            // Handle direct navigations for non-inline screens
                            when (item.label) {
                                "Returns"   -> onNavigateToReturns()
                                "Warehouse" -> if (isWarehouseEnabled) onNavigateToWarehouse()
                            }
                        },
                        icon = {
                            Icon(
                                imageVector = if (selectedTabIndex == index) item.selectedIcon else item.icon,
                                contentDescription = item.label,
                            )
                        },
                        label = { Text(item.label) },
                    )
                }
            }
        },
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
        ) {
            when {
                isLoading -> {
                    CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
                }
                else -> {
                    // ── Overview Tab ──────────────────────────────────────────
                    AnimatedVisibility(
                        visible = selectedTabIndex == 0,
                        enter = fadeIn() + slideInVertically(),
                        exit = fadeOut() + slideOutVertically(),
                    ) {
                        OverviewContent(
                            salesSummary = salesSummary,
                            modifier = Modifier.fillMaxSize(),
                        )
                    }

                    // ── Warehouse notice when feature is disabled ─────────────
                    // This banner only renders if someone somehow navigates here
                    // while warehouse is toggled off (e.g., mid-session change).
                    if (!isWarehouseEnabled && selectedTabIndex == navItems.indexOfFirst { it.label == "Warehouse" }) {
                        WarehouseDisabledBanner(modifier = Modifier.align(Alignment.Center))
                    }
                }
            }
        }
    }
}

// ─── Sub-composables ──────────────────────────────────────────────────────────

@Composable
private fun OverviewContent(
    salesSummary: com.example.data.model.SalesSummary?,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier.padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (salesSummary != null) {
            SummaryCard(label = "Today's Revenue",   value = "PKR ${salesSummary.totalRevenue}")
            SummaryCard(label = "Transactions",       value = "${salesSummary.transactionCount}")
            SummaryCard(label = "Pending Returns",    value = "${salesSummary.pendingReturnCount}")
        } else {
            Text("No sales data available for today.", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun SummaryCard(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(text = label, style = MaterialTheme.typography.labelLarge)
            Text(text = value, style = MaterialTheme.typography.headlineSmall)
        }
    }
}

/**
 * Banner shown when a user's tab selection lands on a now-disabled warehouse
 * section (e.g., subscription was revoked mid-session).
 */
@Composable
private fun WarehouseDisabledBanner(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(
            imageVector = Icons.Default.Lock,
            contentDescription = null,
            modifier = Modifier.size(48.dp),
            tint = MaterialTheme.colorScheme.outline,
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Warehouse module not available",
            style = MaterialTheme.typography.titleMedium,
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = "Contact your platform admin to enable warehouse access.",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

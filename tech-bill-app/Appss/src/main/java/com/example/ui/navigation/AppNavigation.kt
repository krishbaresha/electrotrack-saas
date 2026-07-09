package com.example.ui.navigation

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.ui.screens.DashboardScreen
import com.example.ui.screens.InvoicesScreen
import com.example.ui.theme.*
import com.example.ui.viewmodel.*
import java.text.NumberFormat
import java.util.*

// ==========================================
// 🌌 NAVIGATION GRAPH ROUTE DEFINITIONS
// ==========================================
sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object Invoices : Screen("invoices")
    object StaffAnalytics : Screen("staff_analytics")
    object SuperAdmin : Screen("super_admin")
}

@Composable
fun AppNavigation(
    viewModel: SaaSViewModel,
    userRole: String, // e.g., "owner", "cashier", "platform_admin"
    onLogoutClick: () -> Unit,
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController()
) {
    // Collect WebSocket state or Auth actions: if connection disconnects and reports unauthorized
    // or if a tenant unit status is detected as SUSPENDED, we route back to Login destination.
    val superAdminState by viewModel.superAdminDashboardState.collectAsState()
    val isWebSocketConnected by viewModel.isWebSocketConnected.collectAsState()

    // Tenant check loop: if any tenant status is marked SUSPENDED, invalidate session
    LaunchedEffect(superAdminState.tenants, isWebSocketConnected) {
        val hasSuspendedTenant = superAdminState.tenants.any { it.status == TenantStatus.Suspended }
        if (hasSuspendedTenant || !isWebSocketConnected) {
            // Trigger local wipe mock callback
            onLogoutClick()
            navController.navigate(Screen.Login.route) {
                popUpTo(0) { inclusive = true }
            }
        }
    }

    NavHost(
        navController = navController,
        startDestination = Screen.Dashboard.route,
        modifier = modifier.background(DeepSpaceDark)
    ) {
        // 0. SECURE LOGIN ROUTE
        composable(Screen.Login.route) {
            com.example.ui.screens.LoginScreen(
                onLoginSuccess = { _ ->
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                }
            )
        }

        // 1. OWNER DASHBOARD ROUTE
        composable(Screen.Dashboard.route) {
            DashboardScreen(
                viewModel = viewModel,
                onLogoutClick = {
                    onLogoutClick()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        // 2. INVOICE LEDGER ROUTE
        composable(Screen.Invoices.route) {
            InvoicesScreen(
                viewModel = viewModel,
                onInvoiceClick = { /* Handle invoice click detail interaction */ }
            )
        }

        // 3. STAFF PERFORMANCE LEADERSHIP ROUTE
        composable(Screen.StaffAnalytics.route) {
            val uiState by viewModel.staffAnalyticsState.collectAsState()
            StaffAnalyticsLeaderboardScreen(
                uiState = uiState,
                onStaffClick = { /* Handle employee audit details */ }
            )
        }

        // 4. SUPER ADMIN GLOBAL MATRIX ROUTE (Secured & Gated)
        composable(Screen.SuperAdmin.route) {
            if (userRole == "platform_admin") {
                val uiState by viewModel.superAdminDashboardState.collectAsState()
                SuperAdminMatrixScreen(
                    uiState = uiState,
                    onRenewTenant = { id -> viewModel.renewTenantSubscription(id) },
                    onSuspendTenant = { id -> viewModel.suspendTenantAccount(id) }
                )
            } else {
                // Access Denied Fallback Layout
                AccessDeniedScreen(onGoBack = { navController.popBackStack() })
            }
        }
    }
}

// ==========================================
// 🧱 INTEGRATED STAFF LEADERBOARD COMPOSABLE
// ==========================================

@Composable
fun StaffAnalyticsLeaderboardScreen(
    uiState: StaffAnalyticsUiState,
    onStaffClick: (CashierPerformance) -> Unit
) {
    val sortedStaff = remember(uiState.staffList) {
        uiState.staffList.sortedByDescending { it.totalRevenue }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DeepSpaceDark)
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Column {
                Text(
                    text = "STAFF PERFORMANCE",
                    color = NeonCyan,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "Cashier Leaderboard",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black
                )
            }

            LazyColumn(
                modifier = Modifier.fillMaxWidth().weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                itemsIndexed(sortedStaff, key = { _, staff -> staff.cashierId }) { index, staff ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .antigravityGlass(cornerRadius = 16.dp)
                            .elasticClickable(onClick = { onStaffClick(staff) })
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(
                                        if (index == 0) NeonCyan.copy(alpha = 0.2f) else Color.White.copy(alpha = 0.08f)
                                    )
                                    .border(
                                        width = 1.dp,
                                        color = if (index == 0) NeonCyan else Color.White.copy(alpha = 0.3f),
                                        shape = CircleShape
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = (index + 1).toString(),
                                    color = if (index == 0) NeonCyan else Color.White,
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                            Text(
                                text = staff.name,
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }

                        // Status Badge with pulse simulation
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (staff.isClockedIn) ElectricGreen.copy(alpha = 0.08f) else Color.White.copy(alpha = 0.05f))
                                .border(1.dp, if (staff.isClockedIn) ElectricGreen.copy(alpha = 0.3f) else Color.White.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(if (staff.isClockedIn) ElectricGreen else Color.White.copy(alpha = 0.4f))
                            )
                            Text(
                                text = if (staff.isClockedIn) "Active" else "Offline",
                                color = if (staff.isClockedIn) ElectricGreen else Color.White.copy(alpha = 0.6f),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                }
            }
        }
    }
}

// ==========================================
// 🧱 INTEGRATED SUPER ADMIN SCREEN COMPOSABLE
// ==========================================

@Composable
fun SuperAdminMatrixScreen(
    uiState: SuperAdminDashboardUiState,
    onRenewTenant: (String) -> Unit,
    onSuspendTenant: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(DeepSpaceDark)
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Column {
                Text(
                    text = "GLOBAL CONTROL MATRIX",
                    color = NeonCyan,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 2.sp,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "Telemetry & Subscriptions",
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black
                )
            }

            // Telemetry Grid
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // CPU/Memory widget
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .antigravityGlass(cornerRadius = 14.dp)
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(text = "CPU: ${uiState.serverCpuUsage}%", color = TerminalGreen, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    Text(text = "Mem: ${uiState.serverMemoryUsage}%", color = TerminalGreen, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                }
                // Sockets Count widget
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .antigravityGlass(cornerRadius = 14.dp)
                        .padding(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(text = "WEBSOCKETS", color = Color.White.copy(alpha = 0.5f), fontSize = 9.sp)
                    Text(text = "${uiState.activeWebSocketsCount} Active", color = NeonCyan, fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = FontFamily.Monospace)
                }
            }

            // Tenant management list
            LazyColumn(
                modifier = Modifier.fillMaxWidth().weight(1f),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(uiState.tenants, key = { it.tenantId }) { tenant ->
                    val isSuspended = tenant.status == TenantStatus.Suspended
                    val isExpiring = tenant.status == TenantStatus.Expiring
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .antigravityGlass(cornerRadius = 12.dp)
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(text = tenant.companyName, color = Color.White, fontWeight = FontWeight.Bold)
                            if (isExpiring) {
                                Text(text = "EXPIRING", color = Color(0xFFFFCC00), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(text = "Expires: ${tenant.subscriptionExpiresAt}", color = Color.White.copy(alpha = 0.6f), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(if (isSuspended) Color.White.copy(alpha = 0.1f) else Color(0x33FF3366))
                                        .border(1.dp, if (isSuspended) Color.White.copy(alpha = 0.3f) else Color(0xFFFF3366), RoundedCornerShape(6.dp))
                                        .elasticClickable(onClick = { onSuspendTenant(tenant.tenantId) })
                                        .padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Text(text = if (isSuspended) "UNSUSPEND" else "SUSPEND", color = if (isSuspended) Color.White else Color(0xFFFF3366), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(NeonCyan.copy(alpha = 0.15f))
                                        .border(1.dp, NeonCyan, RoundedCornerShape(6.dp))
                                        .elasticClickable(onClick = { onRenewTenant(tenant.tenantId) })
                                        .padding(horizontal = 10.dp, vertical = 6.dp)
                                ) {
                                    Text(text = "RENEW", color = NeonCyan, fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ==========================================
// 🛡️ SECURITY FALLBACK ACCESS DENIED SCREEN
// ==========================================

@Composable
fun AccessDeniedScreen(onGoBack: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxSize().background(DeepSpaceDark),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterAlignmentLine.run { Alignment.CenterHorizontally },
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Warning,
                contentDescription = "Warning",
                tint = ElectricRed,
                modifier = Modifier.size(64.dp)
            )
            Text(
                text = "ACCESS RESTRICTED",
                color = ElectricRed,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                fontFamily = FontFamily.Monospace
            )
            Text(
                text = "Gated for platform_admin role credentials only.",
                color = Color.White.copy(alpha = 0.6f),
                fontSize = 12.sp
            )
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.White.copy(alpha = 0.1f))
                    .elasticClickable(onClick = onGoBack)
                    .padding(horizontal = 16.dp, vertical = 10.dp)
            ) {
                Text(text = "Return to Dashboard", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}

package com.example.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.example.ui.screens.DashboardScreen
import com.example.ui.screens.LoginScreen
import com.example.ui.screens.ReturnsListScreen
import com.example.ui.screens.ReturnDetailScreen
import com.example.ui.screens.WarehouseScreen
import com.example.ui.viewmodel.AuthViewModel
import com.example.ui.viewmodel.TenantConfigViewModel

// ─── Sealed Route definitions ─────────────────────────────────────────────────

sealed class Screen(val route: String) {
    object Login         : Screen("login")
    object Dashboard     : Screen("dashboard")
    object ReturnsList   : Screen("returns")
    object ReturnDetail  : Screen("return_detail/{returnId}") {
        fun buildRoute(id: String) = "return_detail/$id"
    }
    /** Warehouse route — only injected into the NavHost when isWarehouseEnabled == true */
    object Warehouse     : Screen("warehouse")
}

// ─── Root NavHost ──────────────────────────────────────────────────────────────

/**
 * AppNavigation — root Compose navigation graph for TechBill mobile.
 *
 * ## Dynamic RBAC Warehouse Gating
 * The [WarehouseScreen] composable destination is conditionally included in the
 * NavHost based on the reactive [TenantConfigViewModel.isWarehouseEnabled] state
 * flag. When the flag is `false`:
 *   - The warehouse route is not registered in the graph at all.
 *   - Any navigation calls to [Screen.Warehouse.route] will silently no-op.
 *   - The Dashboard bottom-nav item for Warehouse is hidden (see [DashboardScreen]).
 *
 * This ensures feature gating cannot be bypassed by direct deep-link injection
 * without a layout/route to land on.
 */
@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController(),
) {
    val authViewModel: AuthViewModel = hiltViewModel()
    val tenantConfigViewModel: TenantConfigViewModel = hiltViewModel()

    val isLoggedIn by authViewModel.isLoggedIn.collectAsState()
    val isWarehouseEnabled by tenantConfigViewModel.isWarehouseEnabled.collectAsState()

    val startDestination = if (isLoggedIn) Screen.Dashboard.route else Screen.Login.route

    NavHost(
        navController = navController,
        startDestination = startDestination,
    ) {

        // ── Auth ──────────────────────────────────────────────────────────────
        composable(Screen.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    // Reload tenant config immediately after login
                    tenantConfigViewModel.refreshConfig()
                    navController.navigate(Screen.Dashboard.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
            )
        }

        // ── Dashboard (always accessible) ─────────────────────────────────────
        composable(Screen.Dashboard.route) {
            DashboardScreen(
                isWarehouseEnabled = isWarehouseEnabled,
                onNavigateToReturns = { navController.navigate(Screen.ReturnsList.route) },
                onNavigateToWarehouse = {
                    // Guard at call-site too — belt-and-suspenders
                    if (isWarehouseEnabled) {
                        navController.navigate(Screen.Warehouse.route)
                    }
                },
                onLogout = {
                    authViewModel.logout()
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }

        // ── Returns ───────────────────────────────────────────────────────────
        composable(Screen.ReturnsList.route) {
            ReturnsListScreen(
                onReturnClick = { id ->
                    navController.navigate(Screen.ReturnDetail.buildRoute(id))
                },
                onBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Screen.ReturnDetail.route,
            arguments = listOf(navArgument("returnId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val returnId = backStackEntry.arguments?.getString("returnId") ?: return@composable
            ReturnDetailScreen(
                returnId = returnId,
                onBack = { navController.popBackStack() },
            )
        }

        // ── Warehouse — dynamically gated ─────────────────────────────────────
        // The route is only added to the graph when the tenant has warehouse access.
        // Removing it from the graph means no deep-link, no back-stack entry,
        // and no accidental rendering for non-entitled tenants.
        if (isWarehouseEnabled) {
            composable(Screen.Warehouse.route) {
                WarehouseScreen(
                    onBack = { navController.popBackStack() },
                )
            }
        }
    }
}

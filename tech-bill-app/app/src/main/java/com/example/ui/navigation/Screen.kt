package com.example.ui.navigation

sealed class Screen(val route: String) {
    object Login : Screen("login")
    object Dashboard : Screen("dashboard")
    object Invoices : Screen("invoices")
    object OnlineOrders : Screen("online_orders")
    object Profile : Screen("profile")
}

package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.example.ui.theme.*
import com.example.ui.viewmodel.SaaSViewModel

/**
 * ProfileScreen — standalone composable that binds all fields to the active
 * [SaaSViewModel] session context.
 *
 * This screen is also embedded as the [ProfileTab] inside [DashboardScreen].
 * It can be used independently if routed directly for testing.
 *
 * All displayed data (name, email, role, subscription, notifications) is derived
 * from reactive Flows, ensuring it always reflects the current authenticated session.
 */
@Composable
fun ProfileScreen(
    viewModel: SaaSViewModel,
    modifier: Modifier = Modifier
) {
    val name                   by viewModel.userName.collectAsStateWithLifecycle()
    val email                  by viewModel.userEmail.collectAsStateWithLifecycle()
    val userRole               by viewModel.userRole.collectAsStateWithLifecycle()
    val subscriptionEnd        by viewModel.currentPeriodEnd.collectAsStateWithLifecycle()
    val pushNotificationsEnabled by viewModel.pushNotificationsEnabled.collectAsStateWithLifecycle()
    val onlineSellingEnabled   by viewModel.onlineSellingEnabled.collectAsStateWithLifecycle()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBgStart)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // ── Screen title ──────────────────────────────────────────────────────
        Text(
            text = "Profile Settings",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Text(
            text = "Console configuration, profile details, and telemetry switches.",
            fontSize = 13.sp,
            color = DarkTextSecondary,
            modifier = Modifier.padding(bottom = 6.dp)
        )

        // ── Business Avatar / User Profile card ───────────────────────────────
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

                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    // ── Dynamic name bound to authenticated session ────────────
                    Text(
                        text = name ?: "Guest User",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = email ?: "—",
                        fontSize = 13.sp,
                        color = DarkTextSecondary
                    )
                    if (!userRole.isNullOrBlank()) {
                        Spacer(modifier = Modifier.height(2.dp))
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

            // ── Subscription details ──────────────────────────────────────────
            if (!subscriptionEnd.isNullOrBlank()) {
                HorizontalDivider(color = DarkBorder)
                Column(modifier = Modifier.padding(18.dp)) {
                    ProfileMetricRow(
                        label = "Plan Active Until",
                        value = subscriptionEnd!!.take(10),
                        icon = Icons.Default.Notifications,
                        valueColor = AccentAmber
                    )
                    if (onlineSellingEnabled) {
                        Spacer(modifier = Modifier.height(8.dp))
                        ProfileMetricRow(
                            label = "Online Selling",
                            value = "Enabled",
                            icon = Icons.Default.Person,
                            valueColor = AccentGreen
                        )
                    }
                }
            }
        }

        // ── System settings ───────────────────────────────────────────────────
        Text(
            text = "SYSTEM SETTINGS",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = DarkTextSecondary,
            letterSpacing = 1.sp
        )

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

                // ── Wired toggle: delegates to viewModel.togglePushNotifications ──
                Switch(
                    checked = pushNotificationsEnabled,
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

        // ── Sign Out — wired to viewModel.logout() ────────────────────────────
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

@Composable
fun ProfileMetricRow(
    label: String,
    value: String,
    icon: ImageVector,
    valueColor: Color = DarkTextPrimary
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            fontSize = 13.sp,
            color = DarkTextSecondary,
            fontWeight = FontWeight.Medium
        )
        Text(
            text = value,
            fontSize = 13.sp,
            color = valueColor,
            fontWeight = FontWeight.Bold
        )
    }
}

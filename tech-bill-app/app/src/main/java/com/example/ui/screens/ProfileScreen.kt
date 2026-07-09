package com.example.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Person
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

@Composable
fun ProfileScreen(
    viewModel: SaaSViewModel,
    modifier: Modifier = Modifier
) {
    val name by viewModel.userName.collectAsState()
    val email by viewModel.userEmail.collectAsState()
    val subscriptionEnd by viewModel.currentPeriodEnd.collectAsState()
    val pushNotificationsEnabled by viewModel.pushNotificationsEnabled.collectAsState()
    val onlineSellingEnabled by viewModel.onlineSellingEnabled.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBgStart)
            .padding(horizontal = 16.dp)
    ) {
        Spacer(modifier = Modifier.height(20.dp))

        // Screen title
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
            modifier = Modifier.padding(top = 2.dp, bottom = 24.dp)
        )

        // Business Avatar / User Profile details card
        Card(
            colors = CardDefaults.cardColors(
                containerColor = DarkSurface
            ),
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
                // Large stylized icon avatar
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
                        text = name ?: "Guest User",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                    Text(
                        text = email ?: "guest@techbill.app",
                        fontSize = 13.sp,
                        color = DarkTextSecondary
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Business / Subscription details
        Text(
            text = "BUSINESS DETAILS",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = DarkTextSecondary,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(bottom = 10.dp)
        )

        Card(
            colors = CardDefaults.cardColors(
                containerColor = DarkSurface
            ),
            shape = RoundedCornerShape(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                ProfileMetricRow(
                    label = "Enterprise Name",
                    value = "Tech With Moiz",
                    icon = Icons.Default.Business
                )
                ProfileMetricRow(
                    label = "Subscription Scope",
                    value = if (onlineSellingEnabled) "Online & Offline Channels" else "Offline-Only Channel",
                    icon = Icons.Default.Business
                )
                ProfileMetricRow(
                    label = "Subscription Renew Date",
                    value = subscriptionEnd ?: "No renewal logged",
                    icon = Icons.Default.Business,
                    valueColor = if (viewModel.showSubscriptionWarning.collectAsState().value) AccentAmber else DarkTextPrimary
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Settings / Push Toggle
        Text(
            text = "SYSTEM SETTINGS",
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold,
            color = DarkTextSecondary,
            letterSpacing = 1.sp,
            modifier = Modifier.padding(bottom = 10.dp)
        )

        Card(
            colors = CardDefaults.cardColors(
                containerColor = DarkSurface
            ),
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
                        imageVector = Icons.Default.NotificationsActive,
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

                // Push Switch
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

        Spacer(modifier = Modifier.height(24.dp))

        // Sign Out Section
        Card(
            colors = CardDefaults.cardColors(
                containerColor = DarkSurface
            ),
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
                    imageVector = Icons.AutoMirrored.Filled.Logout,
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
    icon: androidx.compose.ui.graphics.vector.ImageVector,
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

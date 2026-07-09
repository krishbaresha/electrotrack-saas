package com.example.ui.screens

import androidx.compose.animation.*
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Person
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.ui.theme.*
import com.example.ui.viewmodel.SaaSViewModel
import com.example.ui.viewmodel.OwnerDashboardUiState
import com.example.ui.viewmodel.StoreEvent
import java.text.NumberFormat
import java.util.*

import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.remember
import androidx.compose.runtime.LaunchedEffect

@Composable
fun DashboardScreen(
    viewModel: SaaSViewModel,
    onLogoutClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    // Collecting uiState flow from SaaSViewModel with lifecycle awareness
    val uiState by viewModel.ownerDashboardState.collectAsStateWithLifecycle()

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DeepSpaceDark)
            .padding(16.dp)
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // 1. TOP BAR ZONE (Floating Glass Panel)
            TopBarZone(
                userName = "Admin Owner",
                onLogoutClick = onLogoutClick
            )

            // 2. FINANCIAL METRICS GRID WITH ACCUMULATOR
            FinancialMetricsGrid(
                sales = uiState.totalSales,
                revenue = uiState.totalRevenue,
                netProfit = uiState.totalNetProfit
            )

            // 3. GATED ONLINE ANALYTICS CARD WITH EXPANDING ANIMATION
            AnimatedVisibility(
                visible = uiState.isOnlineOptionEnabled,
                enter = expandVertically(animationSpec = spring(stiffness = Spring.StiffnessLow)) + fadeIn(),
                exit = shrinkVertically(animationSpec = spring(stiffness = Spring.StiffnessLow)) + fadeOut(),
                modifier = Modifier.animateContentSize()
            ) {
                OnlineAnalyticsCard(onlineSales = uiState.onlineSales)
            }

            // 4. LIVE ACTIVITY TRACKER (Websocket logs feed)
            LiveActivityTracker(events = uiState.liveEvents)
        }
    }
}

@Composable
private fun TopBarZone(
    userName: String,
    onLogoutClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .antigravityGlass(cornerRadius = 20.dp)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(40.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.15f))
                    .border(1.dp, NeonCyan, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.Person,
                    contentDescription = "User Profile",
                    tint = NeonCyan,
                    modifier = Modifier.size(24.dp)
                )
            }
            Column {
                Text(
                    text = userName,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Text(
                    text = "TechBill Mobile",
                    color = NeonCyan,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(CircleShape)
                .background(Color.White.copy(alpha = 0.08f))
                .border(1.dp, NeonPurple.copy(alpha = 0.5f), CircleShape)
                .elasticClickable(onClick = onLogoutClick),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.ExitToApp,
                contentDescription = "Logout",
                tint = NeonPurple,
                modifier = Modifier.size(18.dp)
            )
        }
    }
}

@Composable
private fun FinancialMetricsGrid(
    sales: Int,
    revenue: Double,
    netProfit: Double
) {
    Column(
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text(
            text = "FINANCIAL PERFORMANCE VECTORS",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.5.sp
        )

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(modifier = Modifier.weight(1f)) {
                MetricCard(
                    title = "Total Sales",
                    value = sales.toDouble(),
                    isCurrency = false
                )
            }
            Box(modifier = Modifier.weight(1f)) {
                MetricCard(
                    title = "Revenue",
                    value = revenue,
                    isCurrency = true
                )
            }
        }

        Row(
            modifier = Modifier.fillMaxWidth()
        ) {
            Box(modifier = Modifier.fillMaxWidth()) {
                MetricCard(
                    title = "Total Net Profit",
                    value = netProfit,
                    isCurrency = true,
                    glowColor = ElectricGreen
                )
            }
        }
    }
}

@Composable
private fun MetricCard(
    title: String,
    value: Double,
    isCurrency: Boolean,
    glowColor: Color = NeonCyan
) {
    var triggerAnimation by remember { mutableStateOf(false) }
    
    // Encapsulate the LaunchedEffect key properly to trigger state transitions correctly
    LaunchedEffect(value) {
        triggerAnimation = true
    }

    val animatedValueState = animateFloatAsState(
        targetValue = if (triggerAnimation) value.toFloat() else 0f,
        animationSpec = tween(durationMillis = 1200, easing = FastOutSlowInEasing),
        label = "numericAccumulator"
    )

    // Remember the value to prevent recomposition cycles during fast-rendering cycles
    val animatedValue by remember { derivedStateOf { animatedValueState.value } }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .antigravityGlass(cornerRadius = 16.dp)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            text = title.uppercase(Locale.getDefault()),
            color = Color.White.copy(alpha = 0.5f),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold
        )

        val formattedValue = remember(animatedValue, isCurrency) {
            if (isCurrency) {
                val format = NumberFormat.getCurrencyInstance(Locale.US)
                format.format(animatedValue.toDouble())
            } else {
                animatedValue.toInt().toString()
            }
        }

        Text(
            text = formattedValue,
            color = Color.White,
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            fontFamily = FontFamily.Monospace
        )

        Box(
            modifier = Modifier
                .fillMaxWidth(0.4f)
                .height(2.dp)
                .background(
                    brush = Brush.horizontalGradient(
                        colors = listOf(glowColor, Color.Transparent)
                    )
                )
        )
    }
}

@Composable
private fun OnlineAnalyticsCard(
    onlineSales: Double
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .antigravityGlass(cornerRadius = 16.dp)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "ONLINE INTEGRATION PORTAL",
                color = NeonCyan,
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp
            )
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(NeonCyan)
            )
        }

        Text(
            text = "Online Order Analytics is fully operational. Cumulative API telemetry reads are synced.",
            color = Color.White.copy(alpha = 0.7f),
            fontSize = 13.sp
        )

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "Direct Digital Inflow:",
                color = Color.White.copy(alpha = 0.5f),
                fontSize = 12.sp
            )
            Text(
                text = NumberFormat.getCurrencyInstance(Locale.US).format(onlineSales),
                color = NeonCyan,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
private fun LiveActivityTracker(
    events: List<StoreEvent>
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .weight(1f),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Text(
            text = "LIVE ACTIVITY FEED (WEBSOCKET)",
            color = Color.White.copy(alpha = 0.6f),
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 1.5.sp
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .antigravityGlass(cornerRadius = 18.dp)
                .padding(12.dp)
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (events.isEmpty()) {
                    item {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "Awaiting socket stream payload...",
                                color = Color.White.copy(alpha = 0.4f),
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }
                } else {
                    items(events, key = { it.id }) { event ->
                        LiveEventRow(event = event)
                    }
                }
            }
        }
    }
}

@Composable
private fun LiveEventRow(event: StoreEvent) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val alphaAnim by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseAlpha"
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Color.White.copy(alpha = 0.04f))
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.weight(1f)
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(ElectricGreen.copy(alpha = alphaAnim))
            )
            Text(
                text = event.message,
                color = Color.White.copy(alpha = 0.85f),
                fontSize = 12.sp,
                fontFamily = FontFamily.SansSerif
            )
        }
        Text(
            text = event.timestamp,
            color = Color.White.copy(alpha = 0.4f),
            fontSize = 10.sp,
            fontFamily = FontFamily.Monospace
        )
    }
}

package com.example.ui.theme

import android.graphics.RenderEffect
import android.graphics.Shader
import android.os.Build
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.forEachGesture
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.MaterialTheme
import androidx.compose.material.darkColors
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

// ==========================================
// 🌌 THEME COLOR TOKENS
// ==========================================
val NeonCyan = Color(0xFF00F0FF)
val NeonPurple = Color(0xFFD900FF)
val ElectricGreen = Color(0xFF00FF66)
val ElectricRed = Color(0xFFFF3366)
val TranslucentGlassWhite = Color(0x1EFFFFFF)
val DeepSpaceDark = Color(0xFF0A0B10)
val TerminalGreen = Color(0xFF39FF14)

private val DarkColorPalette = darkColors(
    primary = NeonCyan,
    primaryVariant = NeonPurple,
    secondary = ElectricGreen,
    background = DeepSpaceDark,
    surface = DeepSpaceDark
)

@Composable
fun AntigravityGlassTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colors = DarkColorPalette,
        content = content
    )
}

// ==========================================
// 🌌 GLOBAL CUSTOM MODIFIERS
// ==========================================

fun Modifier.antigravityGlass(
    cornerRadius: Dp = 16.dp,
    borderWidth: Dp = 1.2.dp
): Modifier = composed {
    val glassShape = RoundedCornerShape(cornerRadius)

    this
        .drawBehind {
            drawIntoCanvas { canvas ->
                val paint = Paint().asFrameworkPaint().apply {
                    color = NeonPurple.copy(alpha = 0.15f).toArgb()
                    setShadowLayer(
                        30f, 
                        0f, 
                        8f, 
                        NeonCyan.copy(alpha = 0.2f).toArgb()
                    )
                }
                canvas.nativeCanvas.drawRoundRect(
                    0f,
                    0f,
                    size.width,
                    size.height,
                    cornerRadius.toPx(),
                    cornerRadius.toPx(),
                    paint
                )
            }
        }
        .background(
            color = Color.White.copy(alpha = 0.12f),
            shape = glassShape
        )
        .graphicsLayer {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                renderEffect = RenderEffect.createBlurEffect(
                    20f,
                    20f,
                    Shader.TileMode.CLAMP
                ).asComposeRenderEffect()
            }
        }
        .then(
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
                Modifier.blur(20.dp, edgeTreatment = androidx.compose.ui.draw.BlurredEdgeTreatment.Unbounded)
            } else Modifier
        )
        .clip(glassShape)
        .border(
            width = borderWidth,
            brush = Brush.linearGradient(
                colors = listOf(
                    NeonCyan.copy(alpha = 0.8f),
                    NeonPurple.copy(alpha = 0.8f),
                    Color.Black.copy(alpha = 0.2f),
                    Color.Transparent
                ),
                startX = 0f,
                startY = 0f
            ),
            shape = glassShape
        )
}

fun Modifier.elasticClickable(
    interactionSource: MutableInteractionSource = remember { MutableInteractionSource() },
    onClick: () -> Unit
): Modifier = composed {
    var isPressed by remember { mutableStateOf(false) }
    
    val scale by animateFloatAsState(
        targetValue = if (isPressed) 0.96f else 1.0f,
        animationSpec = spring(
            dampingRatio = Spring.DampingRatioMediumBouncy,
            stiffness = Spring.StiffnessLow
        ),
        label = "elasticScale"
    )

    this
        .graphicsLayer {
            scaleX = scale
            scaleY = scale
        }
        .pointerInput(Unit) {
            forEachGesture {
                awaitPointerEventScope {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    isPressed = true
                    val up = waitForUpOrCancellation()
                    isPressed = false
                    if (up != null) {
                        onClick()
                    }
                }
            }
        }
}

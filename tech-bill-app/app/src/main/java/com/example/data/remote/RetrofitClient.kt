package com.example.data.remote

import android.content.Context
import com.example.data.local.TokenManager
import com.example.data.model.RefreshRequest
import com.example.data.model.RefreshResponse
import com.squareup.moshi.Moshi
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import kotlinx.coroutines.flow.firstOrNull
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private const val BASE_URL = "https://electrotrack-saas.onrender.com/"

    val moshi: Moshi = Moshi.Builder()
        .addLast(KotlinJsonAdapterFactory())
        .build()

    fun createApiService(context: Context, tokenManager: TokenManager): ApiService {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val authInterceptor = Interceptor { chain ->
            val request = chain.request()
            val path = request.url.encodedPath

            // Skip authorization header for login or refresh paths
            if (path.contains("auth/login") || path.contains("auth/refresh")) {
                return@Interceptor chain.proceed(request)
            }

            val accessToken = runBlocking { tokenManager.accessToken.firstOrNull() }
            val authenticatedRequest = if (!accessToken.isNullOrEmpty()) {
                request.newBuilder()
                    .header("Authorization", "Bearer $accessToken")
                    .build()
            } else {
                request
            }

            chain.proceed(authenticatedRequest)
        }

        val authenticator = object : Authenticator {
            override fun authenticate(route: Route?, response: Response): Request? {
                // Prevent infinite refresh loops
                if (responseCount(response) >= 3) {
                    return null
                }

                val refreshToken = runBlocking { tokenManager.refreshToken.firstOrNull() } ?: return null

                // Synchronously call refresh endpoint using a standalone OkHttpClient
                val refreshClient = OkHttpClient.Builder()
                    .addInterceptor(loggingInterceptor)
                    .build()

                val refreshRetrofit = Retrofit.Builder()
                    .baseUrl(BASE_URL)
                    .client(refreshClient)
                    .addConverterFactory(MoshiConverterFactory.create(moshi))
                    .build()

                val refreshService = refreshRetrofit.create(ApiService::class.java)

                try {
                    val refreshResponse = refreshService.refreshTokens(RefreshRequest(refreshToken)).execute()
                    if (refreshResponse.isSuccessful && refreshResponse.body() != null) {
                        val body = refreshResponse.body()!!
                        runBlocking {
                            tokenManager.saveTokens(body.accessToken, body.refreshToken)
                        }
                        // Retry the failed request with the new access token
                        return response.request.newBuilder()
                            .header("Authorization", "Bearer ${body.accessToken}")
                            .build()
                    } else {
                        // Refresh failed, clear session
                        runBlocking {
                            tokenManager.clearSession()
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }

                return null
            }
        }

        val okHttpClient = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .authenticator(authenticator)
            .build()

        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create(moshi))
            .build()
            .create(ApiService::class.java)
    }

    private fun responseCount(response: Response): Int {
        var result = 1
        var priorResponse = response.priorResponse
        while (priorResponse != null) {
            result++
            priorResponse = priorResponse.priorResponse
        }
        return result
    }
}

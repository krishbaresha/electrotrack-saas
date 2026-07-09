package com.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.ViewModelProvider
import com.example.data.local.TokenManager
import com.example.data.remote.RetrofitClient
import com.example.data.repository.SaaSDataRepository
import com.example.ui.navigation.AppNavigation
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.viewmodel.SaaSViewModel
import com.example.ui.viewmodel.SaaSViewModelFactory

class MainActivity : ComponentActivity() {
    private lateinit var viewModel: SaaSViewModel

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Manual Clean Dependency Injection Assembly
        val tokenManager = TokenManager(applicationContext)
        val apiService = RetrofitClient.createApiService(applicationContext, tokenManager)
        val database = com.example.data.local.AppDatabase.getDatabase(applicationContext)
        val repository = SaaSDataRepository(apiService, tokenManager, database)
        val factory = com.example.ui.viewmodel.SaaSViewModelFactory(repository)
        viewModel = ViewModelProvider(this, factory)[SaaSViewModel::class.java]

        enableEdgeToEdge()
        
        setContent {
            MyApplicationTheme {
                AppNavigation(viewModel = viewModel)
            }
        }
    }
}

# Graph Report - .  (2026-07-09)

## Corpus Check
- Corpus is ~12,760 words - fits in a single context window. You may not need a graph.

## Summary
- 230 nodes · 328 edges · 24 communities (21 shown, 3 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Data Repository Operations|Data Repository Operations]]
- [[_COMMUNITY_Network API Models|Network API Models]]
- [[_COMMUNITY_SaaS View Model|SaaS View Model]]
- [[_COMMUNITY_Invoices Orders Screens|Invoices Orders Screens]]
- [[_COMMUNITY_Auth Network Setup|Auth Network Setup]]
- [[_COMMUNITY_App Initialization|App Initialization]]
- [[_COMMUNITY_Dashboard UI|Dashboard UI]]
- [[_COMMUNITY_Offline Action DB|Offline Action DB]]
- [[_COMMUNITY_Navigation Profile Screens|Navigation Profile Screens]]
- [[_COMMUNITY_Inventory Database|Inventory Database]]
- [[_COMMUNITY_Sales Database|Sales Database]]
- [[_COMMUNITY_Push Notifications|Push Notifications]]
- [[_COMMUNITY_Navigation Routes|Navigation Routes]]
- [[_COMMUNITY_Background Sync|Background Sync]]
- [[_COMMUNITY_Insights Components|Insights Components]]
- [[_COMMUNITY_Instrumentation Tests|Instrumentation Tests]]
- [[_COMMUNITY_Robolectric Tests|Robolectric Tests]]
- [[_COMMUNITY_Unit Tests|Unit Tests]]

## God Nodes (most connected - your core abstractions)
1. `SaaSViewModel` - 26 edges
2. `SaaSDataRepository` - 20 edges
3. `TokenManager` - 11 edges
4. `AppNavigation()` - 10 edges
5. `DashboardScreen()` - 10 edges
6. `SaleItem` - 9 edges
7. `ApiService` - 9 edges
8. `SaleDao` - 7 edges
9. `SaleEntity` - 7 edges
10. `InventoryItem` - 7 edges

## Surprising Connections (you probably didn't know these)
- `DashboardScreen()` --calls--> `AiInsightsCard()`  [INFERRED]
  app/src/main/java/com/example/ui/screens/DashboardScreen.kt → app/src/main/java/com/example/ui/components/AiInsightsCard.kt
- `AppNavigation()` --calls--> `DashboardScreen()`  [INFERRED]
  app/src/main/java/com/example/ui/navigation/AppNavigation.kt → app/src/main/java/com/example/ui/screens/DashboardScreen.kt
- `AppNavigation()` --calls--> `InvoicesScreen()`  [INFERRED]
  app/src/main/java/com/example/ui/navigation/AppNavigation.kt → app/src/main/java/com/example/ui/screens/InvoicesScreen.kt
- `AppNavigation()` --calls--> `OnlineOrdersScreen()`  [INFERRED]
  app/src/main/java/com/example/ui/navigation/AppNavigation.kt → app/src/main/java/com/example/ui/screens/OnlineOrdersScreen.kt
- `MainActivity` --references--> `SaaSViewModel`  [EXTRACTED]
  app/src/main/java/com/example/MainActivity.kt → app/src/main/java/com/example/ui/viewmodel/SaaSViewModel.kt

## Import Cycles
- None detected.

## Communities (24 total, 3 thin omitted)

### Community 0 - "Data Repository Operations"
Cohesion: 0.15
Nodes (8): SalesSummaryResponse, Boolean, Flow, List, Result, String, SaaSDataRepository, Unit

### Community 1 - "Network API Models"
Cohesion: 0.12
Nodes (13): LoginRequest, LoginResponse, RefreshRequest, RefreshResponse, TenantInfo, UserInfo, WarrantyDetails, ApiService (+5 more)

### Community 2 - "SaaS View Model"
Cohesion: 0.15
Nodes (9): InventoryItem, SaleItem, Boolean, com, List, String, SaaSViewModel, StateFlow (+1 more)

### Community 3 - "Invoices Orders Screens"
Cohesion: 0.18
Nodes (16): formatAmount(), formatIsoDateTime(), InvoiceListItemCard(), InvoicesScreen(), Boolean, com, Modifier, String (+8 more)

### Community 4 - "Auth Network Setup"
Cohesion: 0.15
Nodes (9): Boolean, Flow, String, TokenManager, Context, Int, RetrofitClient, Moshi (+1 more)

### Community 5 - "App Initialization"
Cohesion: 0.12
Nodes (10): MainActivity, Boolean, MyApplicationTheme(), SaaSViewModelFactory, GreetingScreenshotTest, Bundle, Class, ComponentActivity (+2 more)

### Community 6 - "Dashboard UI"
Cohesion: 0.18
Nodes (14): Modifier, RevenueChart(), Boolean, Modifier, StickyWarningBanner(), ChannelBreakdownCard(), DashboardScreen(), Color (+6 more)

### Community 7 - "Offline Action DB"
Cohesion: 0.14
Nodes (8): AppDatabase, getDatabase(), Context, Int, List, OfflineActionDao, OfflineActionEntity, RoomDatabase

### Community 8 - "Navigation Profile Screens"
Cohesion: 0.16
Nodes (11): androidx, AppNavigation(), Modifier, NavigationItem, Modifier, LoginScreen(), Color, Modifier (+3 more)

### Community 9 - "Inventory Database"
Cohesion: 0.21
Nodes (5): InventoryDao, Flow, List, fromDomainModel(), InventoryEntity

### Community 10 - "Sales Database"
Cohesion: 0.26
Nodes (4): Flow, List, SaleDao, SaleEntity

### Community 11 - "Push Notifications"
Cohesion: 0.32
Nodes (4): String, MyFirebaseMessagingService, FirebaseMessagingService, RemoteMessage

### Community 12 - "Navigation Routes"
Cohesion: 0.52
Nodes (6): Dashboard, Invoices, Login, OnlineOrders, Profile, Screen

### Community 13 - "Background Sync"
Cohesion: 0.40
Nodes (3): Result, SyncWorker, CoroutineWorker

### Community 14 - "Insights Components"
Cohesion: 0.60
Nodes (4): AiInsightsCard(), InsightBulletItem(), Modifier, String

## Knowledge Gaps
- **2 isolated node(s):** `TenantInfo`, `WarrantyDetails`
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SaaSViewModel` connect `SaaS View Model` to `Navigation Profile Screens`, `Invoices Orders Screens`, `App Initialization`, `Dashboard UI`?**
  _High betweenness centrality (0.315) - this node is a cross-community bridge._
- **Why does `SaaSDataRepository` connect `Data Repository Operations` to `Network API Models`, `SaaS View Model`, `App Initialization`, `Offline Action DB`?**
  _High betweenness centrality (0.183) - this node is a cross-community bridge._
- **Why does `SaleItem` connect `SaaS View Model` to `Data Repository Operations`, `Network API Models`, `Offline Action DB`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `TokenManager` (e.g. with `.onMessageReceived()` and `.onCreate()`) actually correct?**
  _`TokenManager` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `AppNavigation()` (e.g. with `.onCreate()` and `DashboardScreen()`) actually correct?**
  _`AppNavigation()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `TenantInfo`, `WarrantyDetails` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Data Repository Operations` be split into smaller, more focused modules?**
  _Cohesion score 0.14666666666666667 - nodes in this community are weakly interconnected._
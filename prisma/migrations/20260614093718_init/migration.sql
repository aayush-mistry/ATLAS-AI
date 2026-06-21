-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'WORKER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "payment" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "workerWallet" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Application_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCost" REAL NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "txHash" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expectedImpact" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "message" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BusinessState" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "walletBalance" REAL NOT NULL DEFAULT 5000.0,
    "walletAddress" TEXT NOT NULL DEFAULT '0x8eCe6838D6CAd5F62A4FE7CEaC32Ff14aE9f6920',
    "lemonadePrice" REAL NOT NULL DEFAULT 20.0,
    "revenue" REAL NOT NULL DEFAULT 0.0,
    "expenses" REAL NOT NULL DEFAULT 0.0,
    "profit" REAL NOT NULL DEFAULT 0.0,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MarketCondition" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "weather" TEXT NOT NULL DEFAULT 'Sunny',
    "lemonPrice" REAL NOT NULL DEFAULT 4.0,
    "sugarPrice" REAL NOT NULL DEFAULT 2.0,
    "cupPrice" REAL NOT NULL DEFAULT 1.0,
    "icePrice" REAL NOT NULL DEFAULT 0.5,
    "demandLevel" REAL NOT NULL DEFAULT 0.8,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_item_key" ON "Inventory"("item");

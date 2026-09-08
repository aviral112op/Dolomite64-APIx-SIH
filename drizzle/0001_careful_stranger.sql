CREATE TABLE `backtest_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runKey` varchar(80) NOT NULL,
	`referenceSource` varchar(255) NOT NULL,
	`referenceStatus` enum('official','licensed','demo','pending_review') NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date NOT NULL,
	`dayCount` int NOT NULL,
	`routeCount` int NOT NULL,
	`meanAbsolutePercentageError` decimal(10,4) NOT NULL,
	`rootMeanSquareError` decimal(10,4) NOT NULL,
	`correlation` decimal(10,6) NOT NULL,
	`reportUri` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `backtest_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `backtest_runs_runKey_unique` UNIQUE(`runKey`)
);
--> statement-breakpoint
CREATE INDEX `backtest_created_idx` ON `backtest_runs` (`createdAt`);
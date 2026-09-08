CREATE TABLE `collection_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runKey` varchar(80) NOT NULL,
	`triggerType` enum('scheduled','manual','replay') NOT NULL,
	`status` enum('running','completed','partial','failed') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`observationCount` int NOT NULL DEFAULT 0,
	`sourceCount` int NOT NULL DEFAULT 0,
	`errorCount` int NOT NULL DEFAULT 0,
	`coverageRatio` decimal(7,4) NOT NULL DEFAULT '0',
	`errorSummary` text,
	CONSTRAINT `collection_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `collection_runs_runKey_unique` UNIQUE(`runKey`)
);
--> statement-breakpoint
CREATE TABLE `fare_observations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int,
	`sourceId` varchar(80) NOT NULL,
	`sourceQuoteId` varchar(160),
	`origin` varchar(3) NOT NULL,
	`destination` varchar(3) NOT NULL,
	`travelDate` date NOT NULL,
	`leadDays` int NOT NULL,
	`carrier` varchar(80) NOT NULL,
	`flightNumber` varchar(32),
	`fareFamily` varchar(80),
	`fareClass` varchar(12),
	`currency` varchar(3) NOT NULL DEFAULT 'INR',
	`baseFare` decimal(10,2) NOT NULL,
	`taxes` decimal(10,2) NOT NULL DEFAULT '0',
	`udf` decimal(10,2) NOT NULL DEFAULT '0',
	`mandatoryCharges` decimal(10,2) NOT NULL DEFAULT '0',
	`optionalCharges` decimal(10,2) NOT NULL DEFAULT '0',
	`totalFare` decimal(10,2) NOT NULL,
	`availabilityStatus` enum('available','sold_out','cancelled','unknown') NOT NULL DEFAULT 'available',
	`qualityStatus` enum('eligible','outlier_candidate','rejected','insufficient_breakdown') NOT NULL DEFAULT 'eligible',
	`provenanceUri` text,
	`parserVersion` varchar(32) NOT NULL DEFAULT 'collector-v1',
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fare_observations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `index_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int,
	`frequency` enum('daily','weekly','monthly') NOT NULL,
	`routeCode` varchar(16) NOT NULL,
	`value` decimal(10,4) NOT NULL,
	`changePct` decimal(10,4) NOT NULL DEFAULT '0',
	`basePeriod` varchar(32) NOT NULL DEFAULT '2026-01',
	`observationCount` int NOT NULL DEFAULT 0,
	`coverageRatio` decimal(7,4) NOT NULL DEFAULT '0',
	`qualityStatus` enum('provisional','published','unavailable') NOT NULL DEFAULT 'provisional',
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `index_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `route_basket` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routeCode` varchar(16) NOT NULL,
	`origin` varchar(3) NOT NULL,
	`destination` varchar(3) NOT NULL,
	`cityPair` varchar(120) NOT NULL,
	`trafficWeight` decimal(10,7) NOT NULL,
	`basketVersion` varchar(32) NOT NULL DEFAULT 'v1.0',
	`enabled` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `route_basket_id` PRIMARY KEY(`id`),
	CONSTRAINT `route_basket_routeCode_unique` UNIQUE(`routeCode`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`scheduleCronTaskUid` varchar(65),
	`cronExpression` varchar(40) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`lastTriggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `scheduled_jobs_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `source_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` varchar(80) NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`accessMethod` enum('licensed_api','permitted_feed','fixture') NOT NULL,
	`status` enum('approved','pending','blocked','degraded') NOT NULL DEFAULT 'pending',
	`termsUrl` text,
	`robotsPolicy` varchar(80) NOT NULL DEFAULT 'review_required',
	`rateLimitPerMinute` int NOT NULL DEFAULT 2,
	`endpointEnvKey` varchar(120),
	`lastCheckedAt` timestamp,
	`lastSuccessAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `source_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `source_policies_sourceId_unique` UNIQUE(`sourceId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `collection_runs_status_idx` ON `collection_runs` (`status`);--> statement-breakpoint
CREATE INDEX `collection_runs_started_idx` ON `collection_runs` (`startedAt`);--> statement-breakpoint
CREATE INDEX `fare_route_date_idx` ON `fare_observations` (`origin`,`destination`,`travelDate`);--> statement-breakpoint
CREATE INDEX `fare_collected_idx` ON `fare_observations` (`collectedAt`);--> statement-breakpoint
CREATE INDEX `fare_source_idx` ON `fare_observations` (`sourceId`);--> statement-breakpoint
CREATE INDEX `index_snapshot_lookup_idx` ON `index_snapshots` (`frequency`,`routeCode`,`calculatedAt`);--> statement-breakpoint
CREATE INDEX `source_policy_status_idx` ON `source_policies` (`status`);
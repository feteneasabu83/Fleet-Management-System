-- Drop non-fleet tables (tickets, knowledge base, plans, submissions,
-- announcements, overtime, ethics, reports) and their enums.
-- Fleet, user, department, auth and notification tables are preserved.

ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "ticketId";

DROP TABLE IF EXISTS "AnnouncementCommentReply" CASCADE;
DROP TABLE IF EXISTS "AnnouncementComment" CASCADE;
DROP TABLE IF EXISTS "Announcement" CASCADE;
DROP TABLE IF EXISTS "ThirdPartySexualAssault" CASCADE;
DROP TABLE IF EXISTS "WomenadnSocilaInclusion" CASCADE;
DROP TABLE IF EXISTS "ReportSchedule" CASCADE;
DROP TABLE IF EXISTS "Report" CASCADE;
DROP TABLE IF EXISTS "AbuseReport" CASCADE;
DROP TABLE IF EXISTS "SubmissionAttachment" CASCADE;
DROP TABLE IF EXISTS "Submission" CASCADE;
DROP TABLE IF EXISTS "ArticleFeedback" CASCADE;
DROP TABLE IF EXISTS "ArticleComment" CASCADE;
DROP TABLE IF EXISTS "ArticleAttachment" CASCADE;
DROP TABLE IF EXISTS "ArticleTag" CASCADE;
DROP TABLE IF EXISTS "Tag" CASCADE;
DROP TABLE IF EXISTS "Article" CASCADE;
DROP TABLE IF EXISTS "PlanReport" CASCADE;
DROP TABLE IF EXISTS "WorkReportItem" CASCADE;
DROP TABLE IF EXISTS "WorkReport" CASCADE;
DROP TABLE IF EXISTS "PlanItem" CASCADE;
DROP TABLE IF EXISTS "PlanHistory" CASCADE;
DROP TABLE IF EXISTS "PlanAssignment" CASCADE;
DROP TABLE IF EXISTS "Plan" CASCADE;
DROP TABLE IF EXISTS "TicketAttachment" CASCADE;
DROP TABLE IF EXISTS "TicketComment" CASCADE;
DROP TABLE IF EXISTS "Ticket" CASCADE;
DROP TABLE IF EXISTS "Category" CASCADE;
DROP TABLE IF EXISTS "AllNotification" CASCADE;
DROP TABLE IF EXISTS "UserOvertimeNotification" CASCADE;
DROP TABLE IF EXISTS "OvertimeNotification" CASCADE;
DROP TABLE IF EXISTS "OvertimeRequest" CASCADE;
DROP TABLE IF EXISTS "HrOvertimeNotification" CASCADE;

DROP TYPE IF EXISTS "TicketStatus";
DROP TYPE IF EXISTS "TicketPriority";
DROP TYPE IF EXISTS "TicketCategory";
DROP TYPE IF EXISTS "SubmissionType";
DROP TYPE IF EXISTS "SubmissionStatus";
DROP TYPE IF EXISTS "ArticleStatus";
DROP TYPE IF EXISTS "ReportStatus";
DROP TYPE IF EXISTS "ReportTargetType";
DROP TYPE IF EXISTS "ScheduleStatus";
DROP TYPE IF EXISTS "ReportFrequency";
DROP TYPE IF EXISTS "PlanStatus";
DROP TYPE IF EXISTS "PlanPeriod";
DROP TYPE IF EXISTS "PlanItemStatus";
DROP TYPE IF EXISTS "WorkReportStatus";
DROP TYPE IF EXISTS "OvertimeType";
DROP TYPE IF EXISTS "OvertimeDurationType";

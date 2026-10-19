// @ts-nocheck
/**
 * base44Client.js - Universal Base44 Compatibility Client for PrimeOS
 * Provides seamless bridge between Base44 SDK calls and local PrimeOS microservices / Supabase.
 */

import { primeos } from './primeosClient.js';

export const base44 = primeos;
export const base44Client = primeos;

// Proxy-backed entities map for any entity name
export const entities = primeos.entities;

// Common direct entity exports
export const PatientRecord = primeos.entities.PatientRecord;
export const Dentist = primeos.entities.Dentist;
export const DentistBlockout = primeos.entities.DentistBlockout;
export const Appointment = primeos.entities.Appointment;
export const Resource = primeos.entities.Resource;
export const ClinicalNote = primeos.entities.ClinicalNote;
export const MedicalRecord = primeos.entities.MedicalRecord;
export const Customer = primeos.entities.Customer;
export const CustomerSegment = primeos.entities.CustomerSegment;
export const Lead = primeos.entities.Lead;
export const LeadInteraction = primeos.entities.LeadInteraction;
export const Interaction = primeos.entities.Interaction;
export const ClientJourney = primeos.entities.ClientJourney;
export const CrmAppointment = primeos.entities.CrmAppointment;
export const CrmSyncSetting = primeos.entities.CrmSyncSetting;
export const CrmWorkflow = primeos.entities.CrmWorkflow;
export const FinancialTransaction = primeos.entities.FinancialTransaction;
export const FinancialGoal = primeos.entities.FinancialGoal;
export const Budget = primeos.entities.Budget;
export const Expense = primeos.entities.Expense;
export const Asset = primeos.entities.Asset;
export const Product = primeos.entities.Product;
export const Sale = primeos.entities.Sale;
export const SalesScript = primeos.entities.SalesScript;
export const Campaign = primeos.entities.Campaign;
export const MarketStrategy = primeos.entities.MarketStrategy;
export const MarketingChannel = primeos.entities.MarketingChannel;
export const MarketingMetric = primeos.entities.MarketingMetric;
export const Channel = primeos.entities.Channel;
export const AbTest = primeos.entities.AbTest;
export const EmailSequence = primeos.entities.EmailSequence;
export const Task = primeos.entities.Task;
export const Pop = primeos.entities.Pop;
export const Sop = primeos.entities.Sop;
export const Activity = primeos.entities.Activity;
export const AutomationWorkflow = primeos.entities.AutomationWorkflow;
export const KnowledgeBase = primeos.entities.KnowledgeBase;
export const Document = primeos.entities.Document;
export const InventoryItem = primeos.entities.InventoryItem;
export const SupportTicket = primeos.entities.SupportTicket;
export const FollowUp = primeos.entities.FollowUp;
export const FollowUpLog = primeos.entities.FollowUpLog;
export const FollowUpRule = primeos.entities.FollowUpRule;
export const ReminderSchedule = primeos.entities.ReminderSchedule;
export const UserEngagement = primeos.entities.UserEngagement;
export const UserPoint = primeos.entities.UserPoint;
export const UserBadge = primeos.entities.UserBadge;
export const ProjectSeo = primeos.entities.ProjectSeo;
export const TarefaSeo = primeos.entities.TarefaSeo;
export const PalavraChave = primeos.entities.PalavraChave;
export const ConteudoSeo = primeos.entities.ConteudoSeo;
export const BackLink = primeos.entities.BackLink;
export const RelatorioSeo = primeos.entities.RelatorioSeo;
export const PrimeGrowthStage = primeos.entities.PrimeGrowthStage;
export const PrimeFunnelLead = primeos.entities.PrimeFunnelLead;
export const PrimeDelegationTask = primeos.entities.PrimeDelegationTask;
export const ReportSchedule = primeos.entities.ReportSchedule;
export const CustomDashboard = primeos.entities.CustomDashboard;
export const KeyPartner = primeos.entities.KeyPartner;
export const ValueProposition = primeos.entities.ValueProposition;
export const BusinessStrategy = primeos.entities.BusinessStrategy;
export const Content = primeos.entities.Content;
export const AppAnalytic = primeos.entities.AppAnalytic;
export const AppReview = primeos.entities.AppReview;
export const AppVersion = primeos.entities.AppVersion;
export const MobileApp = primeos.entities.MobileApp;
export const User = primeos.entities.User;

export default primeos;

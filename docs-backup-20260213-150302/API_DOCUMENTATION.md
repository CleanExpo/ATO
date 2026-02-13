# ATODE Integration API Documentation

**Australian Tax Opportunity Discovery Engine (ATODE)**
**Version**: 8.1 "Scientific Luxury"
**Updated**: 2026-01-30

This document provides comprehensive API documentation for all ATODE endpoints across three integration phases.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Phase 1: Xero Data Sync](#phase-1-xero-data-sync)
4. [Phase 2: Analysis Engines](#phase-2-analysis-engines)
5. [Phase 3: Interactive Questionnaire System](#phase-3-interactive-questionnaire-system)
6. [Error Handling](#error-handling)
7. [Rate Limits](#rate-limits)

---

## Overview

The ATODE API provides automated tax opportunity discovery by:
1. Syncing financial data from Xero
2. Running specialized tax analysis engines
3. Collecting missing data through targeted questionnaires
4. Re-analyzing with improved data quality

### Base URL

Production: https://your-domain.vercel.app/api
Development: http://localhost:3000/api

### Response Format

All endpoints return JSON with consistent structure.

---

## Authentication

All API requests require Xero OAuth 2.0 authentication via session cookies.

### Authentication Flow

1. Initiate OAuth: GET /auth/xero/connect
2. OAuth Callback: GET /auth/xero/callback
3. Session maintained via encrypted cookies

### Required Scopes

- accounting.transactions.read
- accounting.contacts.read
- accounting.reports.read
- payroll.employees.read
- payroll.payruns.read

---

## Complete API Specification

See full documentation including:
- Phase 1 endpoints (Xero data sync)
- Phase 2 endpoints (Analysis engines)
- Phase 3 endpoints (Questionnaire system)
- Error handling
- Rate limits
- Legislation references

Full documentation available in repository.


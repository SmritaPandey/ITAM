# Database Schema (Core ERD)

## Schema Design Principles
- Every table has `tenant_id` (RLS), `id` (UUID primary key), `created_at`, `updated_at`, `created_by`, `updated_by`
- Soft delete via `deleted_at` timestamp (null = active)
- JSONB columns for flexible/extensible attributes
- PostGIS geometry columns for GPS/location data
- TimescaleDB hypertables for time-series metrics
- Referential integrity via foreign keys with appropriate cascades
- Indexes on all frequently queried columns + composite indexes for common query patterns

---

## Core Entity Groups

### 1. Tenant & Auth
```sql
-- tenants: top-level organization
tenants (id, name, slug, domain, plan, status, settings:jsonb, logo_url, ...)

-- sites: physical locations within a tenant
sites (id, tenant_id, name, address, city, country, lat, lng, timezone, ...)

-- departments
departments (id, tenant_id, site_id, name, parent_id, cost_center, ...)

-- users
users (id, tenant_id, email, password_hash, first_name, last_name, phone, 
       department_id, site_id, role_id, status, mfa_enabled, mfa_secret, 
       last_login, avatar_url, preferences:jsonb, ...)

-- roles
roles (id, tenant_id, name, description, is_system, ...)

-- permissions
permissions (id, module, action, resource, description, ...)

-- role_permissions (many-to-many)
role_permissions (role_id, permission_id)

-- api_keys
api_keys (id, tenant_id, user_id, key_hash, name, scopes:jsonb, 
          expires_at, last_used_at, ...)

-- audit_logs (append-only, hash-chained)
audit_logs (id, tenant_id, timestamp, actor_id, actor_ip, action, 
            resource_type, resource_id, before:jsonb, after:jsonb, 
            outcome, severity, module, hash, prev_hash, ...)

-- sessions
sessions (id, user_id, token_hash, ip_address, user_agent, expires_at, ...)
```

### 2. CMDB & Asset Core
```sql
-- asset_types (hierarchical: Hardware > Server > Linux Server)
asset_types (id, tenant_id, name, parent_id, icon, color, 
             is_it_asset, custom_fields_schema:jsonb, ...)

-- assets (unified asset table — the heart of the system)
assets (
  id, tenant_id, asset_type_id, 
  -- Identity
  asset_tag, name, serial_number, barcode, qr_code,
  -- Classification
  category, sub_category, manufacturer, model, 
  -- Location
  site_id, department_id, floor, room, rack, position,
  -- Ownership
  assigned_to (user_id), managed_by (user_id), cost_center,
  -- Lifecycle
  status (enum: discovered, active, in_maintenance, in_storage, 
          retired, disposed, lost, reserved),
  procurement_date, deployment_date, warranty_expiry, 
  eol_date, disposal_date,
  -- Financial
  purchase_price, current_value, depreciation_method, 
  po_number, invoice_number, vendor_id,
  -- Network (for IT assets)
  ip_address, mac_address, hostname, domain, 
  -- GPS (for fleet/tracked assets, PostGIS)
  last_known_location geometry(Point, 4326),
  -- Flexible attributes
  custom_fields:jsonb,
  -- Discovery
  discovery_source (enum: agent, snmp, wmi, ssh, cloud, ad, manual, csv),
  last_scanned_at, agent_id,
  -- Relationships
  parent_asset_id,
  ...
)

-- asset_relationships (CMDB CI relationships)
asset_relationships (
  id, tenant_id, 
  source_asset_id, target_asset_id, 
  relationship_type (enum: depends_on, component_of, connected_to, 
                     runs_on, used_by, backup_of),
  properties:jsonb,
  ...
)

-- asset_history (lifecycle events)
asset_history (id, tenant_id, asset_id, event_type, description, 
               performed_by, details:jsonb, timestamp, ...)

-- asset_attachments
asset_attachments (id, tenant_id, asset_id, file_name, file_url, 
                   file_type, file_size, uploaded_by, ...)
```

### 3. IT-Specific Asset Details
```sql
-- hardware_details (1:1 with asset for IT hardware)
hardware_details (
  id, asset_id,
  cpu_model, cpu_cores, cpu_speed_ghz, 
  ram_total_gb, ram_type,
  disk_total_gb, disk_type (SSD/HDD/NVMe), disk_health,
  gpu_model, gpu_vram_gb,
  bios_version, bios_vendor, uefi_secure_boot,
  tpm_version, tpm_enabled,
  battery_health_percent, battery_cycle_count,
  form_factor (desktop/laptop/server/tablet/vm),
  ...
)

-- os_details
os_details (id, asset_id, os_name, os_version, os_build, 
            os_architecture, install_date, last_boot, uptime_days, ...)

-- software_installations
software_installations (id, tenant_id, asset_id, software_id, 
                        version, install_date, install_path, 
                        is_managed, last_used_at, usage_minutes_30d, ...)

-- software_catalog (master list of known software)
software_catalog (id, tenant_id, name, publisher, category, 
                  is_blacklisted, is_whitelisted, latest_version, ...)

-- security_posture
security_posture (id, asset_id, 
                  av_installed, av_name, av_version, av_definitions_date, 
                  av_realtime_protection,
                  firewall_enabled, firewall_rules_count,
                  encryption_enabled, encryption_type, encryption_percent,
                  last_assessed_at, compliance_score, ...)

-- network_interfaces
network_interfaces (id, asset_id, interface_name, ip_address, 
                    subnet_mask, mac_address, gateway, dns_servers, 
                    is_dhcp, speed_mbps, status, ...)
```

### 4. Network Management (NMS)
```sql
-- network_devices (extends assets for network-specific data)
network_devices (id, asset_id, device_type (switch/router/firewall/ap/etc),
                 snmp_version, community_string_encrypted, 
                 snmp_auth_encrypted:jsonb,
                 sys_descr, sys_oid, sys_name, sys_uptime,
                 firmware_version, ...)

-- network_interfaces_nms
network_interfaces_nms (id, device_id, if_index, if_name, if_descr, 
                        if_type, if_speed, if_admin_status, if_oper_status,
                        if_in_octets, if_out_octets, if_in_errors, 
                        if_out_errors, connected_device_id, connected_port, ...)

-- network_topology_links
network_topology_links (id, tenant_id, source_device_id, source_port,
                        target_device_id, target_port, discovery_protocol,
                        link_type, bandwidth, ...)

-- device_configs
device_configs (id, device_id, config_text, config_hash, captured_at,
                captured_by, is_baseline, diff_from_baseline, ...)

-- snmp_traps
snmp_traps (id, tenant_id, source_ip, trap_oid, variables:jsonb,
            severity, processed, created_ticket_id, timestamp, ...)

-- syslog_entries
syslog_entries (id, tenant_id, source_ip, facility, severity, 
                message, timestamp, ...)

-- network_metrics (TimescaleDB hypertable)
network_metrics (time TIMESTAMPTZ, tenant_id, device_id, interface_id,
                 metric_name, metric_value DOUBLE, ...)
```

### 5. Fleet & GPS
```sql
-- vehicles (extends assets)
vehicles (id, asset_id, vehicle_type, registration_number, 
          vin, make, model, year, color, fuel_type,
          odometer_reading, insurance_expiry, inspection_due,
          assigned_driver_id, gps_device_id, ...)

-- gps_devices
gps_devices (id, tenant_id, imei, device_model, sim_number,
             vehicle_id, status, last_report_at, ...)

-- gps_positions (TimescaleDB hypertable)
gps_positions (time TIMESTAMPTZ, tenant_id, device_id, vehicle_id,
               location geometry(Point, 4326), speed_kmh, heading,
               altitude, satellites, ignition, ...)

-- geofences
geofences (id, tenant_id, name, description, 
           boundary geometry(Polygon, 4326), 
           fence_type (inclusion/exclusion),
           alert_on_entry, alert_on_exit, alert_on_dwell,
           dwell_time_minutes, active, ...)

-- geofence_events
geofence_events (id, tenant_id, vehicle_id, geofence_id, 
                 event_type (entry/exit/dwell), timestamp,
                 location geometry(Point, 4326), ...)

-- trips
trips (id, tenant_id, vehicle_id, driver_id, 
       start_time, end_time, start_location, end_location,
       distance_km, max_speed, avg_speed, fuel_consumed,
       route_polyline, idle_time_minutes, ...)

-- drivers
drivers (id, tenant_id, user_id, license_number, license_expiry,
         license_type, emergency_contact, ...)
```

### 6. Patch Management
```sql
-- patches (known patches/updates)
patches (id, tenant_id, patch_id_vendor, title, description,
         vendor, product, severity (critical/high/medium/low),
         cve_ids:jsonb, kb_number, release_date, 
         superseded_by, download_url, size_bytes,
         is_approved, approved_by, approved_at, ...)

-- asset_patch_status
asset_patch_status (id, tenant_id, asset_id, patch_id,
                    status (missing/installed/failed/pending_reboot/excluded),
                    detected_at, installed_at, installed_by, 
                    failure_reason, ...)

-- patch_deployments (scheduled deployment jobs)
patch_deployments (id, tenant_id, name, description, 
                   patch_ids:jsonb, target_group:jsonb,
                   schedule_type, scheduled_at, 
                   deployment_window_start, deployment_window_end,
                   reboot_policy, status, created_by, ...)

-- patch_deployment_results
patch_deployment_results (id, deployment_id, asset_id, patch_id,
                          status, started_at, completed_at, 
                          error_message, ...)

-- vulnerability_assessments
vulnerability_assessments (id, tenant_id, asset_id, cve_id, 
                           cvss_score, severity, description,
                           affected_software, remediation,
                           status (open/mitigated/accepted/false_positive),
                           detected_at, resolved_at, ...)
```

### 7. License Management
```sql
-- licenses
licenses (id, tenant_id, software_id, license_type 
          (per_seat/per_device/site/enterprise/subscription/oem),
          license_key_encrypted, total_seats, used_seats,
          vendor_id, purchase_date, expiry_date, 
          purchase_price, renewal_price,
          po_number, contract_id, 
          alert_before_days, status, ...)

-- license_assignments
license_assignments (id, license_id, asset_id, user_id,
                     assigned_at, released_at, ...)

-- contracts
contracts (id, tenant_id, vendor_id, contract_type,
           start_date, end_date, value, renewal_type,
           document_url, terms:jsonb, ...)
```

### 8. ITSM / Ticketing
```sql
-- tickets
tickets (id, tenant_id, ticket_number, 
         type (incident/problem/change/service_request/maintenance),
         category, sub_category,
         subject, description, description_html,
         priority (critical/high/medium/low),
         urgency, impact,
         status (new/open/in_progress/pending/on_hold/resolved/closed/cancelled),
         requester_id, assigned_to, assigned_group,
         related_asset_ids:jsonb, 
         sla_id, response_due_at, resolution_due_at,
         responded_at, resolved_at, closed_at,
         satisfaction_score, satisfaction_comment,
         parent_ticket_id, ...)

-- ticket_comments
ticket_comments (id, ticket_id, author_id, content, content_html,
                 is_internal, attachments:jsonb, ...)

-- ticket_history (state changes)
ticket_history (id, ticket_id, changed_by, field_changed, 
                old_value, new_value, timestamp, ...)

-- sla_policies
sla_policies (id, tenant_id, name, priority, 
              response_time_minutes, resolution_time_minutes,
              business_hours_only, escalation_rules:jsonb, ...)

-- work_orders
work_orders (id, tenant_id, ticket_id, asset_id,
             type, description, assigned_to, 
             scheduled_start, scheduled_end,
             actual_start, actual_end,
             parts_used:jsonb, labor_hours, cost,
             status, ...)

-- service_catalog
service_catalog (id, tenant_id, name, description, category,
                 icon, form_schema:jsonb, approval_workflow:jsonb,
                 sla_id, auto_assign_group, ...)

-- knowledge_base
knowledge_base (id, tenant_id, title, content_html, category,
                tags:jsonb, view_count, helpful_count,
                status (draft/published/archived), 
                author_id, ...)
```

### 9. Automation
```sql
-- automation_rules
automation_rules (id, tenant_id, name, description, 
                  is_active, priority,
                  trigger_type (event/schedule/manual),
                  trigger_config:jsonb,
                  conditions:jsonb,
                  actions:jsonb,
                  last_triggered_at, execution_count,
                  created_by, ...)

-- automation_executions
automation_executions (id, rule_id, tenant_id, 
                       trigger_event:jsonb, 
                       actions_executed:jsonb,
                       status (success/partial/failed),
                       started_at, completed_at, 
                       error_message, ...)
```

### 10. Notifications & Alerts
```sql
-- notification_templates
notification_templates (id, tenant_id, name, channel, 
                        subject_template, body_template,
                        variables:jsonb, ...)

-- notifications
notifications (id, tenant_id, user_id, channel, 
               subject, body, is_read, 
               action_url, metadata:jsonb, sent_at, ...)

-- alert_rules
alert_rules (id, tenant_id, name, module, condition:jsonb,
             severity, channels:jsonb, recipients:jsonb,
             cooldown_minutes, is_active, ...)
```

### 11. CCTV
```sql
-- cameras
cameras (id, asset_id, tenant_id, name, ip_address, 
         manufacturer, model, firmware,
         rtsp_main_url_encrypted, rtsp_sub_url_encrypted,
         onvif_credentials_encrypted:jsonb,
         ptz_capable, recording_enabled,
         location_description, 
         site_id, floor, zone,
         status, last_online_at, ...)

-- camera_events
camera_events (id, camera_id, tenant_id, event_type 
               (motion/tamper/offline/online/storage_warning),
               timestamp, snapshot_url, details:jsonb, ...)
```

### 12. Maintenance (EAM)
```sql
-- maintenance_schedules
maintenance_schedules (id, tenant_id, asset_id, 
                       schedule_type (preventive/condition_based),
                       frequency, next_due_date,
                       assigned_team, checklist:jsonb,
                       auto_create_work_order, ...)

-- maintenance_logs
maintenance_logs (id, tenant_id, asset_id, work_order_id,
                  type, description, performed_by, 
                  date, cost, parts_used:jsonb,
                  next_maintenance_date, ...)

-- vendors
vendors (id, tenant_id, name, contact_person, email, phone,
         address, category, rating, contract_ids:jsonb,
         payment_terms, notes, ...)

-- spare_parts
spare_parts (id, tenant_id, name, part_number, category,
             quantity_in_stock, min_stock_level, reorder_quantity,
             unit_cost, vendor_id, location, ...)
```

### 13. VDI
```sql
-- vdi_pools
vdi_pools (id, tenant_id, provider (vmware/citrix/azure/aws),
           pool_name, pool_type, capacity, used,
           connection_config_encrypted:jsonb, ...)

-- vdi_sessions (TimescaleDB hypertable for metrics)
vdi_sessions (time TIMESTAMPTZ, tenant_id, pool_id, 
              session_id, user_id, hostname,
              cpu_percent, ram_percent, disk_iops,
              network_mbps, logon_duration_ms,
              session_state, ...)
```

### 14. Billing (SaaS)
```sql
-- subscriptions
subscriptions (id, tenant_id, plan_id, status,
               start_date, current_period_end,
               billing_cycle, payment_method_id, ...)

-- usage_records
usage_records (id, tenant_id, metric, quantity, 
               recorded_at, billing_period, ...)

-- invoices
invoices (id, tenant_id, invoice_number, amount, 
          currency, status, due_date, paid_at,
          line_items:jsonb, ...)
```

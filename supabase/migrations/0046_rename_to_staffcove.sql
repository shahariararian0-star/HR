-- Migration 0046: Product renamed to StaffCove
--
-- The app's screens, emails and public pages now say StaffCove and link to staffcove.com.
-- Email templates are stored in the database (seeded by 0029-0037), so their copy is updated
-- here; old migration files are left untouched. Only the product name and domain change.

update public.email_templates
   set name          = regexp_replace(regexp_replace(regexp_replace(name,          'openhrapp\.com', 'staffcove.com', 'g'), 'OpenHRApp', 'StaffCove', 'g'), 'OpenHR', 'StaffCove', 'g'),
       body_template = regexp_replace(regexp_replace(regexp_replace(body_template, 'openhrapp\.com', 'staffcove.com', 'g'), 'OpenHRApp', 'StaffCove', 'g'), 'OpenHR', 'StaffCove', 'g')
 where name ~ 'OpenHR|openhrapp\.com'
    or body_template ~ 'OpenHR|openhrapp\.com';

/**
 * Attio sync service — LATAM Deal Flow
 *
 * Flow on completion:
 *   1. Upsert Person (match by email — safe)
 *   2. Find or create Company (safe domain lookup FIRST, no blind upsert)
 *   3. Create Deal linked to Company + Person
 *   4. Add Deal to "Startups Deal Flow LATAM" list (slug: startups_deal_flow_2)
 *
 * Company domain strategy:
 *   - If startup has a website → extract domain → search Attio for existing company
 *   - If found → reuse that record ID (never upsert by domain again)
 *   - If not found → create new company WITH domain
 *   - If no website → create company WITHOUT domain (name-only, avoids domain conflicts)
 */

const ATTIO_API = 'https://api.attio.com/v2';
const ATTIO_TOKEN = process.env.ATTIO_API_KEY;

const LATAM_LIST_SLUG = 'startups_deal_flow_2';
const DEAL_STAGE_LEADS_MEXICO = 'Leads Mexico 2026';
const DEAL_OWNER_MEMBER_ID = '2f347934-032a-411c-a5ef-169cd635dd05'; // carlos@decelera.com

// ---- Generic fetch wrapper ----

type AttioResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function attioFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<AttioResult<T>> {
  try {
    const res = await fetch(`${ATTIO_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${ATTIO_TOKEN}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Attio ${res.status} on ${path}: ${body}` };
    }

    return { ok: true, data: (await res.json()) as T };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ---- Helpers ----

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    // Remove www. prefix — Attio normalizes domains without it
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ---- Step 1: Person ----

export interface PersonInput {
  fullName: string;
  email: string;
  linkedin?: string;
}

async function upsertPerson(input: PersonInput): Promise<AttioResult<{ id: string }>> {
  // Safe: email is the matching attribute for people — no domain conflict risk
  const result = await attioFetch<{ data: { id: { record_id: string } } }>(
    '/objects/people/records?matching_attribute=email_addresses',
    {
      method: 'PUT',
      body: JSON.stringify({
        data: {
          values: {
            name: [{ first_name: input.fullName.split(' ')[0], last_name: input.fullName.split(' ').slice(1).join(' ') || '', full_name: input.fullName }],
            email_addresses: [{ email_address: input.email }],
            ...(input.linkedin ? { linkedin: [{ value: input.linkedin }] } : {}),
          },
        },
      }),
    }
  );

  if (!result.ok) return result;
  return { ok: true, data: { id: result.data.data.id.record_id } };
}

// ---- Step 2: Company (safe domain handling) ----

export interface CompanyInput {
  name: string;
  website?: string;
  description?: string;
}

/**
 * Search Attio for a company by domain. Returns record_id if found, null if not.
 * This is the safe lookup BEFORE any create/upsert.
 */
async function findCompanyByDomain(domain: string): Promise<AttioResult<string | null>> {
  const result = await attioFetch<{ data: { id: { record_id: string } }[] }>(
    '/objects/companies/records/query',
    {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          domains: { $eq: domain },
        },
        limit: 1,
      }),
    }
  );

  if (!result.ok) return result;
  const records = result.data.data;
  if (records.length === 0) return { ok: true, data: null };
  return { ok: true, data: records[0].id.record_id };
}

/**
 * Create a brand new company record. Used when no existing record was found.
 */
async function createCompany(input: CompanyInput, domain: string | null): Promise<AttioResult<{ id: string }>> {
  const values: Record<string, unknown> = {
    name: [{ value: input.name }],
    ...(input.description ? { description: [{ value: input.description }] } : {}),
    // Only include domains if we have one — avoids blank domain conflicts
    ...(domain ? { domains: [{ domain }] } : {}),
  };

  const result = await attioFetch<{ data: { id: { record_id: string } } }>(
    '/objects/companies/records',
    {
      method: 'POST',
      body: JSON.stringify({ data: { values } }),
    }
  );

  if (!result.ok) return result;
  return { ok: true, data: { id: result.data.data.id.record_id } };
}

/**
 * Main company resolver:
 *   - Has domain → search first → reuse if found, create if not
 *   - No domain → always create (name-only, no domain conflicts possible)
 */
async function resolveCompany(input: CompanyInput): Promise<AttioResult<{ id: string; existed: boolean }>> {
  const domain = input.website ? extractDomain(input.website) : null;

  if (domain) {
    // Safe lookup first
    const lookup = await findCompanyByDomain(domain);
    if (!lookup.ok) return lookup;

    if (lookup.data) {
      // Company already exists — reuse, don't touch domains
      console.log(`[Attio] Company found by domain ${domain}: ${lookup.data}`);
      return { ok: true, data: { id: lookup.data, existed: true } };
    }
  }

  // Not found or no domain → create fresh
  const created = await createCompany(input, domain);
  if (!created.ok) return created;
  return { ok: true, data: { id: created.data.id, existed: false } };
}

// ---- Step 3: Deal ----

export interface DealInput {
  companyId: string;
  personId: string;
  answers: Record<string, unknown>;
}

async function createDeal(input: DealInput): Promise<AttioResult<{ id: string }>> {
  const a = input.answers;

  // Build values — only include fields that have actual data
  const values: Record<string, unknown> = {
    // Required
    name: [{ value: String(a.startup_name ?? 'Unnamed startup') }],
    stage: [{ status: { title: DEAL_STAGE_LEADS_MEXICO } }],
    owner: [{ workspace_member_id: DEAL_OWNER_MEMBER_ID }],

    // Relationships
    associated_company: [{ target_object: 'companies', target_record_id: input.companyId }],
    associated_people: [{ target_object: 'people', target_record_id: input.personId }],
    person: [{ target_object: 'people', target_record_id: input.personId }],
  };

  // Conditionally add fields
  const addText = (slug: string, val: unknown) => {
    if (val) values[slug] = [{ value: String(val) }];
  };
  const addSelect = (slug: string, val: unknown) => {
    if (val) values[slug] = String(val);
  };
  const addBool = (slug: string, val: unknown) => {
    if (val !== undefined && val !== null) values[slug] = val ? 'Sí' : 'No';
  };
  const addMultiSelect = (slug: string, val: unknown) => {
    if (Array.isArray(val) && val.length > 0) values[slug] = val.map(String);
    else if (val) values[slug] = [String(val)];
  };
  const addNumber = (slug: string, val: unknown) => {
    const n = Number(val);
    if (!isNaN(n) && val !== '' && val !== null && val !== undefined) values[slug] = n;
  };

  // Founder
  addText('linkedin_1', a.founder_linkedin);
  addSelect('number_of_founders', a.number_of_founders);
  addMultiSelect('collective_milestones', a.collective_milestones);
  addSelect('experience_in_sector', a.experience_in_sector);
  addText('relevant_experience_explanation', a.relevant_experience_explanation);
  addBool('full_time_cto', a.technical_cofounder);

  // Startup
  addText('deck_url', a.deck_url);
  addSelect('constitution_company', a.constitution_location);
  addNumber('constitution_year', a.constitution_year);
  addMultiSelect('sector', a.startup_sector);
  addMultiSelect('business_model', a.business_model);
  addMultiSelect('operations_location', a.operations_location);

  // Problem / Product
  addText('problem', a.problem);
  addText('icp', a.icp);
  addText('the_secret', a.the_secret);
  addText('soul_of_the_project', a.soul_of_the_project);
  addText('demo', a.demo_url);
  addText('tech_stack', a.tech_stack);

  // Traction
  addText('north_star', a.north_star);
  addSelect('mom_growth', a.mom_growth);
  addSelect('churn_avg_last_3_months', a.churn);
  addSelect('net_burn_avg_monthly_4', a.net_burn);
  addSelect('runway', a.runway);
  addSelect('organic_users', a.organic_users);
  addMultiSelect('unit_economics', a.unit_economics);
  addMultiSelect('most_significant_milestone_6', a.most_significant_milestone);

  // Fundraising
  addSelect('raised', a.raised_amount);
  addNumber('raise', a.raising_amount);
  addSelect('stage_round', a.stage_round);
  addNumber('acv', a.acv);
  addNumber('potential_clients', a.potential_clients);
  addSelect('equity', a.equity);
  addNumber('pre_money_valuation_7', a.pre_money_valuation);

  // Defensibility / Why now
  addMultiSelect('defensibility_4', a.defensibility);
  addSelect('uniqueness_ip', a.third_party_dependance);
  addText('third_party_mitigation', a.third_party_mitigation);
  addSelect('external_tailwind', a.external_tailwind);
  addText('why_now_validation', a.why_now_validation);

  // Compliance & other
  addSelect('compliance_7', a.compliance);
  addText('data_room', a.data_room);
  addSelect('reference_3', a.how_did_you_find_us);
  addText('referral', a.reference_explanation);
  addSelect('newsletter_4', a.newsletter);

  const result = await attioFetch<{ data: { id: { record_id: string } } }>(
    '/objects/deals/records',
    {
      method: 'POST',
      body: JSON.stringify({ data: { values } }),
    }
  );

  if (!result.ok) return result;
  return { ok: true, data: { id: result.data.data.id.record_id } };
}

// ---- Step 4: Add deal to LATAM list ----

async function addDealToLatamList(dealId: string): Promise<AttioResult<void>> {
  const result = await attioFetch<unknown>(
    `/lists/${LATAM_LIST_SLUG}/entries`,
    {
      method: 'POST',
      body: JSON.stringify({
        data: {
          parent_record_id: dealId,
          parent_object: 'deals',
        },
      }),
    }
  );

  if (!result.ok) return result;
  return { ok: true, data: undefined };
}

// ---- Public API ----

export interface SyncResult {
  personId: string;
  companyId: string;
  companyExisted: boolean;
  dealId: string;
  addedToList: boolean;
}

export async function syncSessionToAttio(
  answers: Record<string, unknown>
): Promise<AttioResult<SyncResult>> {

  // 1. Person
  if (!answers.founder_email) {
    return { ok: false, error: 'Missing founder email — cannot sync to Attio' };
  }

  const personResult = await upsertPerson({
    fullName: String(answers.founder_name ?? ''),
    email: String(answers.founder_email),
    linkedin: answers.founder_linkedin ? String(answers.founder_linkedin) : undefined,
  });
  if (!personResult.ok) return personResult;
  const personId = personResult.data.id;

  // 2. Company (safe domain handling)
  const companyResult = await resolveCompany({
    name: String(answers.startup_name ?? 'Unnamed startup'),
    website: answers.startup_website ? String(answers.startup_website) : undefined,
    description: answers.startup_tagline ? String(answers.startup_tagline) : undefined,
  });
  if (!companyResult.ok) return companyResult;
  const { id: companyId, existed: companyExisted } = companyResult.data;

  // 3. Deal
  const dealResult = await createDeal({ companyId, personId, answers });
  if (!dealResult.ok) return dealResult;
  const dealId = dealResult.data.id;

  // 4. Add to LATAM list (best-effort — don't fail the whole sync if this fails)
  const listResult = await addDealToLatamList(dealId);
  if (!listResult.ok) {
    console.warn(`[Attio] Deal created but failed to add to LATAM list: ${listResult.error}`);
  }

  return {
    ok: true,
    data: {
      personId,
      companyId,
      companyExisted,
      dealId,
      addedToList: listResult.ok,
    },
  };
}

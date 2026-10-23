export type Profile = {
  name: string; goal: string; bio: string; school: string; city: string;
  level: string; classCourse: string; interests: string; hours: string;
  lang: 'en' | 'ru' | 'kk'; phone: string;
};
export const profileLimits: Record<keyof Profile, number> = {
  name: 60, goal: 600, bio: 1200, school: 120, city: 100, level: 10,
  classCourse: 60, interests: 300, hours: 3, lang: 2, phone: 40,
};
export function defaultProfile(name = ''): Profile {
  return {name, goal:'', bio:'', school:'', city:'', level:'uni', classCourse:'',
    interests:'', hours:'4', lang:'ru', phone:''};
}
export function normalizePhone(value: string) {
  const phone = value.trim().replace(/[\s().-]/g, '');
  if (!phone) return '';
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}
export function validateProfile(value: unknown): Profile | 'invalid_profile' | 'invalid_phone' {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'invalid_profile';
  const input=value as Record<string,unknown>, out={} as Profile;
  for (const [key,max] of Object.entries(profileLimits)) {
    const v = input[key];
    if (typeof v !== 'string' || v.length > max) return 'invalid_profile';
    (out as Record<string,string>)[key] = v.trim();
  }
  if (!out.name || !['en','ru','kk'].includes(out.lang) ||
      !['7','8','9','10','11','12','a','uni'].includes(out.level) ||
      !/^\d{1,2}$/.test(out.hours) || Number(out.hours)>60) return 'invalid_profile';
  const phone=normalizePhone(out.phone);
  if (phone === null) return 'invalid_phone';
  out.phone=phone;
  return out;
}

import { useAuth } from "@/hooks/useAuth";

// List of emails with dev access - hardcoded and not editable in app
const DEV_ACCESS_EMAILS = [
  "madureira@kaleidosdigital.com"
];

export function useDevAccess() {
  const { user } = useAuth();
  
  const hasDevAccess = user?.email ? DEV_ACCESS_EMAILS.includes(user.email.toLowerCase()) : false;
  
  return {
    hasDevAccess,
  };
}

/**
 * Wrapper client-side do Facebook JS SDK.
 *
 * Carrega SDK lazy (so quando o user clica "Conectar Instagram"). Evita peso
 * de bundle inicial e o trackeamento do FB pra users que nunca vao usar.
 *
 * App ID em NEXT_PUBLIC_FACEBOOK_APP_ID (publico). APP_SECRET fica so no server.
 */

const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
const API_VERSION = "v21.0";

export type FbStatus = "connected" | "not_authorized" | "unknown";

export interface FbAuthResponse {
  accessToken: string;
  expiresIn: number;
  signedRequest: string;
  userID: string;
  graphDomain?: string;
  data_access_expiration_time?: number;
}

export interface FbLoginResponse {
  status: FbStatus;
  authResponse: FbAuthResponse | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fb = any;

declare global {
  interface Window {
    FB?: Fb;
    fbAsyncInit?: () => void;
  }
}

let loadingPromise: Promise<Fb> | null = null;

function getAppId(): string {
  const id = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID;
  if (!id) throw new Error("NEXT_PUBLIC_FACEBOOK_APP_ID missing");
  return id;
}

export function loadFacebookSdk(): Promise<Fb> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("FB SDK only available in browser"));
  }
  if (window.FB) return Promise.resolve(window.FB);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    window.fbAsyncInit = () => {
      try {
        window.FB!.init({
          appId: getAppId(),
          cookie: true,
          xfbml: false,
          version: API_VERSION,
        });
        window.FB!.AppEvents.logPageView();
        resolve(window.FB);
      } catch (err) {
        reject(err);
      }
    };

    // Inject script tag (mesmo idempotente check do SDK oficial).
    if (!document.getElementById("facebook-jssdk")) {
      const js = document.createElement("script");
      js.id = "facebook-jssdk";
      js.src = SDK_SRC;
      js.async = true;
      js.defer = true;
      js.crossOrigin = "anonymous";
      js.onerror = () => reject(new Error("Failed to load Facebook SDK"));
      document.head.appendChild(js);
    }
  });

  return loadingPromise;
}

export async function getLoginStatus(): Promise<FbLoginResponse> {
  const FB = await loadFacebookSdk();
  return new Promise((resolve) => {
    FB.getLoginStatus((res: FbLoginResponse) => resolve(res));
  });
}

export async function loginWithFacebook(scope: string[]): Promise<FbLoginResponse> {
  const FB = await loadFacebookSdk();
  return new Promise((resolve) => {
    FB.login(
      (res: FbLoginResponse) => resolve(res),
      {
        scope: scope.join(","),
        return_scopes: true,
        enable_profile_selector: true,
      }
    );
  });
}

export async function logoutFromFacebook(): Promise<void> {
  const FB = await loadFacebookSdk();
  return new Promise((resolve) => {
    FB.logout(() => resolve());
  });
}

// Permissões padrão pra SV: publicar + ler dados do perfil IG Business/Creator.
export const SV_FB_SCOPES = [
  "public_profile",
  "email",
  "pages_show_list",
  "instagram_basic",
  "instagram_content_publish",
];

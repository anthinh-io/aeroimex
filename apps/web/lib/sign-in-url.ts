export function signInPath(pathname: string, search: string): string {
  return `/sign-in?${new URLSearchParams({ next: pathname + search })}`;
}

import LoginForm from "./LoginForm";

export const instant = false;

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const raw = params?.next;
  const nextParam = Array.isArray(raw) ? raw[0] : raw;
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <LoginForm next={next} />
    </main>
  );
}

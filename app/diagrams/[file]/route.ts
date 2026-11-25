import { diagramFiles, diagramSvg } from "@/lib/procedures";
import { plateFiles } from "@/lib/plates";

export const dynamic = "force-static";
export function generateStaticParams() { return [...new Set([...diagramFiles(), ...plateFiles()])].map((file) => ({ file })); }

export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  return new Response(diagramSvg(file), { headers: { "Content-Type": "image/svg+xml" } });
}

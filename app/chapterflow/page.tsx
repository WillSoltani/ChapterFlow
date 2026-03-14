import { redirect } from "next/navigation";
import { getChapterFlowLaunchHref } from "@/app/_lib/chapterflow-brand";

export default function ChapterFlowRedirectPage() {
  redirect(getChapterFlowLaunchHref());
}

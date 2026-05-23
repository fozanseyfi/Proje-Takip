"use client";

import { useState } from "react";
import { Eye, Copy, Lock } from "lucide-react";
import { useCurrentProject, isDemoProject } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { CloneProjectDialog } from "@/components/projects/clone-project-dialog";

/**
 * Demo proje sayfa başında gösterilen banner.
 * Sadece o anki proje demo ise render edilir; aksi halde null.
 */
export function DemoProjectBanner() {
  const project = useCurrentProject();
  const [cloneOpen, setCloneOpen] = useState(false);

  if (!project || !isDemoProject(project)) return null;

  return (
    <>
      <div className="sticky top-0 z-30 bg-gradient-to-r from-yellow/15 via-yellow/10 to-yellow/15 border-b border-yellow/40">
        <div className="px-4 py-2 flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-yellow text-white text-[10px] font-bold uppercase tracking-widest">
            <Eye size={11} />
            Demo
          </div>
          <div className="flex-1 text-[12.5px] text-text leading-snug">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={12} className="text-yellow-700" />
              <span>
                <strong>Bu proje örnek olarak sergilenir.</strong> Değişiklikler kaydedilmez.
                Kendi çalışma kopyanı oluşturmak için klonla.
              </span>
            </span>
          </div>
          <Button
            size="sm"
            variant="accent"
            onClick={() => setCloneOpen(true)}
            className="shrink-0"
          >
            <Copy size={13} /> Klonla
          </Button>
        </div>
      </div>

      <CloneProjectDialog open={cloneOpen} onClose={() => setCloneOpen(false)} source={project} />
    </>
  );
}

import { useEffect, useRef } from "react";
import { TEMPLATES, type TemplateId } from "@/components/cover/types";
import { patchDossierChrome } from "@/lib/dossier-chrome";
import { recommendedHeaderPatchForTemplate } from "@/lib/template-chrome";

const TEMPLATE_QA_STEP_EVENT = "cv-cover-charm:template-qa-step";
const RETIRED_TEMPLATE_IDS = new Set(["warm4", "warm5"]);
const QA_TEMPLATES = [...TEMPLATES]
  .filter((template) => !RETIRED_TEMPLATE_IDS.has(template.id as string))
  .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));

type TemplateQaScope = "both" | "cv" | "letter";
type TemplateQaStepDetail = { direction: -1 | 1 };

export function dispatchTemplateQaTemplateStep(direction: -1 | 1) {
  window.dispatchEvent(
    new CustomEvent<TemplateQaStepDetail>(TEMPLATE_QA_STEP_EVENT, {
      detail: { direction },
    }),
  );
}

function applyHeaderRecommendation(template: TemplateId, scope: TemplateQaScope) {
  const recommendation = recommendedHeaderPatchForTemplate(template);
  if (!recommendation) return;
  if (scope !== "letter") patchDossierChrome("cv", recommendation);
  if (scope !== "cv") patchDossierChrome("letter", recommendation);
}

/**
 * Connects the global QA shortcut to the route's real React template state.
 * This deliberately does not depend on the collapsible picker being mounted.
 */
export function useTemplateQaTemplateSwitch(
  value: TemplateId,
  onChange: (template: TemplateId) => void,
  scope: TemplateQaScope,
) {
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  }, [value, onChange]);

  useEffect(() => {
    const onStep = (event: Event) => {
      const direction =
        (event as CustomEvent<TemplateQaStepDetail>).detail?.direction === -1 ? -1 : 1;
      const currentIndex = QA_TEMPLATES.findIndex(
        (template) => template.id === valueRef.current,
      );
      if (currentIndex < 0 || QA_TEMPLATES.length < 2) return;

      const nextIndex =
        (currentIndex + direction + QA_TEMPLATES.length) % QA_TEMPLATES.length;
      const nextTemplate = QA_TEMPLATES[nextIndex];
      if (!nextTemplate) return;

      applyHeaderRecommendation(nextTemplate.id, scope);
      onChangeRef.current(nextTemplate.id);
    };

    window.addEventListener(TEMPLATE_QA_STEP_EVENT, onStep);
    return () => window.removeEventListener(TEMPLATE_QA_STEP_EVENT, onStep);
  }, [scope]);
}

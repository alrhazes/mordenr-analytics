import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import type { VoterProfile } from "@/queries/explore";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  voterName: string;
  campaigns: NonNullable<VoterProfile["whatsappBlast"]>["campaigns"];
};

export function VoterWhatsappGallery({
  open,
  onClose,
  voterName,
  campaigns,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close WhatsApp gallery"
            className="fixed inset-0 z-[1300] bg-[var(--color-ink)]/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="fixed inset-4 z-[1400] mx-auto flex max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                  Maklumat WhatsApp Blast
                </div>
                <div className="font-semibold text-[var(--color-ink)]">
                  {voterName}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {campaigns.map((campaign, index) => (
                  <WhatsappCard
                    key={`${campaign.id}-${index}`}
                    campaign={campaign}
                    voterName={voterName}
                    showCampaignNo={campaigns.length > 1}
                    index={index}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

type Campaign = NonNullable<VoterProfile["whatsappBlast"]>["campaigns"][number];

/** Visible only in print/PDF — screen uses the gallery button instead. */
export function VoterWhatsappPrintGrid({
  campaigns,
  voterName,
}: {
  campaigns: Campaign[];
  voterName: string;
}) {
  return (
    <div className="voter-whatsapp-print hidden print:grid print:grid-cols-2 print:gap-4">
      {campaigns.map((campaign, index) => (
        <WhatsappCard
          key={`print-${campaign.id}-${index}`}
          campaign={campaign}
          voterName={voterName}
          showCampaignNo={campaigns.length > 1}
          index={index}
        />
      ))}
    </div>
  );
}

function WhatsappCard({
  campaign,
  voterName,
  showCampaignNo,
  index,
}: {
  campaign: Campaign;
  voterName: string;
  showCampaignNo: boolean;
  index: number;
}) {
  const sentiment = campaign.sentimentLabel.toUpperCase();
  const cardClass =
    sentiment === "PUTIH"
      ? "bg-white text-black border-black"
      : sentiment === "KELABU"
        ? "bg-[#777] text-white border-[#777]"
        : sentiment === "HITAM"
          ? "bg-black text-white border-black"
          : "bg-[var(--color-bg)] text-[var(--color-ink)] border-[var(--color-line)]";

  return (
    <div className="flex flex-col gap-2">
      {showCampaignNo && (
        <div className="text-sm font-bold text-[var(--color-ink-muted)]">
          Kempen {index + 1}
        </div>
      )}
      <a
        href={campaign.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-md border border-[var(--color-line)]"
      >
        <img
          src={campaign.url}
          alt={campaign.campaignName}
          className="max-h-72 w-full object-contain bg-[var(--color-bg)]"
        />
      </a>
      <div
        className={cn(
          "rounded-lg border p-3 text-sm leading-relaxed",
          cardClass,
        )}
      >
        <div className="mb-2 font-bold uppercase">Maklumat WhatsApp</div>
        <div>
          <strong>Kempen:</strong> {campaign.campaignName}
        </div>
        <div>
          <strong>Tarikh:</strong> {campaign.screenshotDateDisplay}
        </div>
        <div>
          <strong>Nama:</strong> {voterName}
        </div>
        <div>
          <strong>Sikap:</strong> {sentiment}
        </div>
        <div>
          <strong>Caption:</strong> {campaign.caption || "—"}
        </div>
      </div>
    </div>
  );
}

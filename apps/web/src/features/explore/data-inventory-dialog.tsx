import { X, Database } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";

/** Static inventory rows ported from modal_data_inventory.php */
const INVENTORY_ROWS: Array<{
  jenis: string;
  jumlah: string;
  sumber: string;
}> = [
  {
    jenis: "PENGUNDI BERDAFTAR (DAFTAR PEMILIH SUKU PERTAMA MAC 2025)",
    jumlah: "21,843,171",
    sumber: "SPR",
  },
  {
    jenis:
      "PENGUNDI BERDAFTAR (DAFTAR PEMILIH SUKU PERTAMA MAC 2025) (No Telefon)",
    jumlah: "11,199,189",
    sumber: "SPR · Mobile",
  },
  {
    jenis:
      "PENGUNDI BERDAFTAR (DAFTAR PEMILIH SUKU PERTAMA MAC 2025) (Geo Located)",
    jumlah: "12,775,728",
    sumber: "SPR · Geocoding",
  },
  {
    jenis:
      "PENGUNDI BERDAFTAR (DAFTAR PEMILIH SUKU PERTAMA MAC 2025) (No Telefon Geo Located)",
    jumlah: "8,450,523",
    sumber: "SPR · Geocoding · Mobile",
  },
  {
    jenis: "PENGUNDI BERDAFTAR (DAFTAR PEMILIH SUKU PERTAMA MAC 2025) (Foto)",
    jumlah: "802,259",
    sumber: "SPR · Pic",
  },
  {
    jenis: "PENGUNDI MELAYU (57%)",
    jumlah: "8,757,296",
    sumber: "",
  },
  {
    jenis: "PENGUNDI BUKAN MELAYU (43%)",
    jumlah: "6,606,381",
    sumber: "",
  },
  {
    jenis: "PENGUNDI BERDAFTAR GEOLOCATION MAPPING",
    jumlah: "12,775,728",
    sumber: "Geocoding",
  },
  { jenis: "AHLI UMNO", jumlah: "3,659,878", sumber: "UMNO" },
  { jenis: "AHLI UMNO (No Telefon)", jumlah: "1,192,186", sumber: "UMNO · Mobile" },
  {
    jenis: "AHLI UMNO (Geo Located)",
    jumlah: "2,424,562",
    sumber: "UMNO · Geocoding",
  },
  { jenis: "AHLI PKR", jumlah: "760,714", sumber: "PKR" },
  { jenis: "AHLI PKR (No Telefon)", jumlah: "504,852", sumber: "PKR · Mobile" },
  {
    jenis: "AHLI PKR (Geo Located)",
    jumlah: "409,262",
    sumber: "PKR · Geocoding",
  },
  { jenis: "AHLI PAS", jumlah: "1,037,932", sumber: "PAS" },
  { jenis: "AHLI PAS (No Telefon)", jumlah: "347,367", sumber: "PAS · Mobile" },
  {
    jenis: "AHLI PAS (Geo Located)",
    jumlah: "409,262",
    sumber: "PAS · Geocoding",
  },
  { jenis: "AHLI PPBM", jumlah: "483,958", sumber: "PPBM" },
  {
    jenis: "AHLI PPBM (No Telefon)",
    jumlah: "239,865",
    sumber: "PPBM · Mobile",
  },
  {
    jenis: "AHLI PPBM (Geo Located)",
    jumlah: "315,238",
    sumber: "PPBM · Geocoding",
  },
  {
    jenis: "KESELURUHAN PENGUNDI BERPARTI",
    jumlah: "6,442,482",
    sumber: "BN · PH · PN",
  },
  {
    jenis: "PENGUNDI MEMPUNYAI NO TELEFON",
    jumlah: "11,199,189",
    sumber: "TM · Maxis · Celcom",
  },
];

export function DataInventoryDialog() {
  const open = useExploreWorkspaceStore((s) => s.inventoryOpen);
  const setOpen = useExploreWorkspaceStore((s) => s.setInventoryOpen);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-50 bg-[var(--color-ink)]/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="inventory-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed inset-x-4 top-[8vh] z-50 mx-auto flex max-h-[84vh] w-[min(96vw,900px)] flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-[var(--color-accent)]" />
                <div>
                  <h2
                    id="inventory-title"
                    className="text-lg font-semibold text-[var(--color-ink)]"
                  >
                    Data Inventory
                  </h2>
                  <p className="text-xs text-[var(--color-ink-muted)]">
                    Kemaskini 20 Apr 2026
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-2">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 bg-[var(--color-bg)] text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Jenis Data</th>
                    <th className="px-3 py-2 text-right">Jumlah</th>
                    <th className="px-3 py-2 text-left">Sumber</th>
                  </tr>
                </thead>
                <tbody>
                  {INVENTORY_ROWS.map((row, i) => (
                    <tr
                      key={row.jenis}
                      className="border-t border-[var(--color-line)]"
                    >
                      <td className="px-3 py-2 text-center tabular-nums text-[var(--color-ink-muted)]">
                        {i + 1}.
                      </td>
                      <td className="px-3 py-2 font-medium">{row.jenis}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">
                        {row.jumlah}
                      </td>
                      <td className="px-3 py-2 text-xs text-[var(--color-ink-muted)]">
                        {row.sumber || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

import { Mail, Phone, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ElectoralImage } from "@/features/explore/electoral-image";
import { VoterPhoto } from "@/features/explore/voter-photo";
import { useVoterProfile, type VoterProfile } from "@/queries/explore";

type Props = {
  ic: string | null;
  onClose: () => void;
};

export function VoterSheet({ ic, onClose }: Props) {
  const profile = useVoterProfile(ic);

  return (
    <AnimatePresence>
      {ic && (
        <>
          <motion.button
            type="button"
            aria-label="Close voter profile"
            className="fixed inset-0 z-[1100] bg-[var(--color-ink)]/25 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-0 right-0 top-0 z-[1200] flex w-full max-w-lg flex-col border-l border-[var(--color-line)] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                Pengundi
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-5">
              {profile.isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-28" />
                  <Skeleton className="h-40" />
                  <Skeleton className="h-40" />
                </div>
              )}

              {profile.isError && (
                <p className="text-sm text-[var(--color-danger)]">
                  {(profile.error as Error).message}
                </p>
              )}

              {profile.data && <VoterProfileBody data={profile.data} />}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function VoterProfileBody({ data }: { data: VoterProfile }) {
  const hasEducation = data.education.length > 0;
  const hasIncome =
    data.income.amount != null && Number.isFinite(data.income.amount);
  const hasPartyMemberships = data.partyMemberships.length > 0;

  return (
    <div className="space-y-5">
      <header className="flex items-start gap-4 border-b border-[var(--color-line)] pb-5">
        <VoterPhoto
          ic={data.ic}
          photo={data.photo}
          photoLocal={data.photoLocal}
          photoFallback={data.photoFallback}
          alt={data.name}
          className="h-24 w-24 rounded-md object-cover object-top"
        />
        <div className="min-w-0 flex-1">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-bold uppercase leading-tight text-[var(--color-ink)]">
            {data.name}
          </h2>
          <p className="mt-1 text-sm font-semibold tabular-nums text-[var(--color-ink-muted)]">
            {data.ic}
          </p>
          {data.sikap ? <SikapBadge sikap={data.sikap} className="mt-3" /> : null}
        </div>
      </header>

      <ProfileSection title="Maklumat Peribadi">
        <InfoRow label="Tarikh lahir" value={data.birthDateDisplay || "—"} />
        <InfoRow label="Negeri kelahiran" value={data.birthPlace || "—"} />
        <InfoRow
          label="Umur"
          value={data.age != null ? `${data.age} TAHUN` : "—"}
        />
        <InfoRow label="Jantina" value={data.gender || "—"} />
        <InfoRow label="Kaum" value={data.race || "—"} />
        <InfoRow label="Agama" value={data.religion || "—"} />
        <InfoRow
          label="Alamat"
          value={
            <AddressBlock
              addressHtml={data.addressHtml}
              addresses={data.addresses}
            />
          }
        />
        <InfoRow
          label="Telefon"
          value={
            data.phones.length ? (
              <div className="space-y-1">
                {data.phones.map((phone) => (
                  <div key={phone} className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{phone}</span>
                  </div>
                ))}
              </div>
            ) : (
              "—"
            )
          }
        />
        <InfoRow
          label="Email"
          value={
            data.emails.length ? (
              <div className="space-y-1">
                {data.emails.map((email) => (
                  <div key={email} className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{email}</span>
                  </div>
                ))}
              </div>
            ) : (
              "—"
            )
          }
        />
        <InfoRow
          label="Media sosial"
          value={
            data.social.length ? (
              <div className="space-y-1">
                {data.social.map((item) => (
                  <a
                    key={item.url}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[var(--color-accent)] hover:underline"
                  >
                    {item.network}
                  </a>
                ))}
              </div>
            ) : (
              "—"
            )
          }
        />
      </ProfileSection>

      {hasEducation && (
        <ProfileSection title="Maklumat Pendidikan">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--color-bg)] text-left text-[11px] uppercase tracking-wide text-[var(--color-ink-muted)]">
                  <th className="border border-[var(--color-line)] px-2 py-1.5">
                    #
                  </th>
                  <th className="border border-[var(--color-line)] px-2 py-1.5">
                    Tarikh
                  </th>
                  <th className="border border-[var(--color-line)] px-2 py-1.5">
                    Institusi
                  </th>
                  <th className="border border-[var(--color-line)] px-2 py-1.5">
                    Pencapaian
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.education.map((row, index) => (
                  <tr key={`${row.confermentDate}-${row.title}-${index}`}>
                    <td className="border border-[var(--color-line)] px-2 py-1.5">
                      {index + 1}.
                    </td>
                    <td className="border border-[var(--color-line)] px-2 py-1.5">
                      {formatShortDate(row.confermentDate)}
                    </td>
                    <td className="border border-[var(--color-line)] px-2 py-1.5">
                      {row.institution}
                    </td>
                    <td className="border border-[var(--color-line)] px-2 py-1.5">
                      {row.title}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ProfileSection>
      )}

      {hasIncome && (
        <ProfileSection title="Maklumat Pendapatan">
          <InfoRow
            label="Pendapatan tahunan"
            value={formatCurrency(data.income.amount!)}
          />
          <InfoRow
            label="Kelas pendapatan"
            value={data.income.class || "—"}
          />
        </ProfileSection>
      )}

      {hasPartyMemberships && (
        <ProfileSection title="Maklumat Parti">
          <div className="space-y-3">
            {data.partyMemberships.map((membership) => (
              <div
                key={`${membership.membershipNo}-${membership.name}`}
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <ElectoralImage
                    src={membership.partyLogo}
                    fallback={membership.partyLogoFallback}
                    alt={membership.name}
                    className="h-6 max-w-[40px] border border-[var(--color-line)] p-0.5"
                  />
                  <span className="font-semibold uppercase">{membership.name}</span>
                </div>
                <div className="mt-2 grid gap-1 pt-2 text-[var(--color-ink-muted)]">
                  <div>No ahli: {membership.membershipNo}</div>
                  <div>Cawangan: {membership.branchName}</div>
                  <div>Divisyen: {membership.divisionName}</div>
                  <div>Negeri: {membership.stateName}</div>
                  <div>Status: {membership.status}</div>
                </div>
              </div>
            ))}
          </div>
        </ProfileSection>
      )}

      <ProfileSection title="Maklumat Electoral">
        <InfoRow
          label="Sikap"
          value={
            data.sikap ? (
              <SikapBadge sikap={data.sikap} />
            ) : (
              "TIADA"
            )
          }
        />
        <InfoRow label="Lokaliti" value={data.lokaliti || "—"} />
        <InfoRow
          label="Daerah mengundi"
          value={
            [data.dmCode, data.dmName].filter(Boolean).join(" ") || "—"
          }
        />
        <InfoRow
          label="DUN"
          value={
            <SeatLine
              code={data.dunCode}
              name={data.dunName}
              party={data.partyDun}
              partyLogo={data.partyDunLogo}
              partyLogoFallback={data.partyLogoFallback}
            />
          }
        />
        <InfoRow
          label="Parlimen"
          value={
            <SeatLine
              code={data.parliamentCode}
              name={data.parliamentName}
              party={data.partyPar}
              partyLogo={data.partyParLogo}
              partyLogoFallback={data.partyLogoFallback}
            />
          }
        />
        <InfoRow label="Negeri" value={data.state || "—"} />
      </ProfileSection>
    </div>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="rounded-t-md bg-[var(--color-ink)] px-3 py-2 text-sm font-semibold uppercase tracking-wide text-white">
        {title}
      </div>
      <div className="overflow-hidden rounded-b-md border border-t-0 border-[var(--color-line)]">
        {children}
      </div>
    </section>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-[var(--color-line)] px-3 py-2.5 text-sm last:border-b-0">
      <div className="font-medium text-[var(--color-ink-muted)]">{label}</div>
      <div className="text-[var(--color-ink)]">{value}</div>
    </div>
  );
}

function AddressBlock({
  addressHtml,
  addresses,
}: {
  addressHtml: string;
  addresses: VoterProfile["addresses"];
}) {
  if (!addressHtml && !addresses.length) return <>—</>;

  return (
    <div className="space-y-2">
      {addressHtml ? (
        <div
          className="leading-relaxed [&_br]:block"
          dangerouslySetInnerHTML={{ __html: addressHtml }}
        />
      ) : null}
      {addresses.map((address) => (
        <div key={address.fullAddress} className="leading-relaxed">
          {address.fullAddress}
        </div>
      ))}
    </div>
  );
}

function SeatLine({
  code,
  name,
  party,
  partyLogo,
  partyLogoFallback,
}: {
  code: string;
  name: string;
  party: string;
  partyLogo: string;
  partyLogoFallback: string;
}) {
  const line = [code, name].filter(Boolean).join(" ");
  if (!line) return <>—</>;

  return (
    <div className="flex items-center gap-2">
      {party ? (
        <ElectoralImage
          src={partyLogo}
          fallback={partyLogoFallback}
          alt={party}
          className="h-6 max-w-[40px] border border-[var(--color-line)] p-0.5"
        />
      ) : null}
      <span>{line}</span>
    </div>
  );
}

function SikapBadge({
  sikap,
  className = "",
}: {
  sikap: string;
  className?: string;
}) {
  const normalized = sikap.toUpperCase();
  const styles =
    normalized === "PUTIH"
      ? "border border-black bg-white text-black"
      : normalized === "KELABU"
        ? "border border-white bg-[#777] text-white"
        : normalized === "HITAM"
          ? "border border-black bg-black text-white"
          : "border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-ink)]";

  return (
    <span
      className={`inline-flex px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${styles} ${className}`}
    >
      {normalized}
    </span>
  );
}

function formatShortDate(raw: string) {
  if (!raw) return "—";
  const date = new Date(raw.slice(0, 10));
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return `RM ${amount.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

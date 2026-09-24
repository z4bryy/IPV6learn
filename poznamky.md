IPV 6 základ PSI

Internet protokol verze 6
----
Internet — jedna velká (globální) síť
internet — propojení více sítí
----
IPv4 — standard RFC 791 (1981), práce od konce 70. let
IPv6 — 90. léta (drafty ~1995–96), RFC 2460 (1998), dnes RFC 8200
----
1980 — osobní počítače minimum, sítě hlavně ve firmách
Provoz tehdy hlavně data — e-maily, zprávy, text
----
Data, Video, Voice
Dnes nejpoužívanější je Video
----
IPv6 vzniklo kvůli nedostatku IPv4 adres (~4,3 miliardy u IPv4 = 2^32)
Další důvody: větší adresní prostor, auto-konfigurace, růst typů provozu
----
IPv4: binárně (0/1), zápis desítkový (0–255) — př. 128.164.22.47
IPv4 = 4 oktety oddělené tečkou

IPv6: binárně uvnitř, zápis hexadecimální (0–9, a–f)
IPv6 = 8 hextetů (po 16 bitech) oddělených dvojtečkou
př. 2001:0db8:7654:3210:fedc:ba98:7654:3210
----
IPv6: 2^128 adres
IPv4: 2^32 adres (~4,3 mld)
----
IPv4 odděluje . (oktety)
IPv6 odděluje : (hextety)
Hextet = 16 bitů = 4 hexadecimální číslice (každá číslice = 4 bity)

VLSM u IPv6 je často přehlednější než u IPv4 (velký prostor)
Subnetting: typicky /64 pro LAN; u /48→/64 je subnet ID ve 4. hextetu

IPv6 zkracujeme — plný zápis je zbytečně dlouhý
1) vynechat úvodní nuly v hextetu (0000 → 0, 0db8 → db8)
2) :: nahradí nejdelší řadu nulových hextetů — jen jednou
0000:1111:0000:2222 → 0:1111:0:2222 (dále podle zbytku adresy)
nesmí být 1222::2222::… (dvakrát :: — neplatné)

----------------------

Speciální IPv6 adresy
::1/128 — loopback
::/128 — unspecified (neurčená adresa)
fe80::/10 — link-local (v praxi tvar fe80::/64)
2000::/3 — global unicast (rozsah 2000–3fff…)
2001:db8::/32 — výuková / dokumentační global unicast

---------------------------

IPv4 přidělení adresy:
- staticky
- DHCP

IPv6 přidělení adresy (3 způsoby):
- staticky
- SLAAC (bezstavová auto-konfigurace)
- DHCPv6 (stavové přidělení)

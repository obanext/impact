# OBA Impactmeter — interview + affirmatieve output

Werkende projectstructuur voor Flask op Vercel, met een gewone HTML/JS-frontend. De oude Assistants-API (`/v1/threads`) is vervangen door **OpenAI Conversations + Responses**. De oorspronkelijke Assistants zijn verloren; de instructies zijn gereconstrueerd uit de gedeelde projectbespreking en zijn **geen exacte kopie**.

## Wat is gebouwd?

- `/start`: nieuwe OpenAI Conversation; leest bij elk interview de **modulaire** `contextvragen.csv`.
- `/chat`: één vraag tegelijk; gevalideerde antwoorden; een natuurlijke, waarderende overgang die *ook kritische of negatieve ervaringen respecteert*. B1 NL/EN.
- Afsluiting: resultaat in JSON, keuze **persoonlijke affirmatieve wens** of **gegenereerde afbeelding** via `/output`.
- `/export`: individuele antwoorden als downloadbare CSV; in de browser is ook een JSON-download.
- `interview_instructions.txt` en `output_instructions.txt`: apart aanpasbare assistentinstructies in GitHub.
- Antwoorden worden tijdens het interview in de browser bijgehouden en voor reacties doorgegeven aan de server. De OpenAI Conversation heeft de interviewuitwisseling. **Er is geen centrale, blijvende CSV-opslag**; gebruik de download. Voor centrale opslag is een database/objectopslag nodig.

## Deploy via GitHub en Vercel

1. Upload de **inhoud** van deze projectmap naar je GitHub-repository. Upload geen `.env`. GitHub bewaart de code; de webapp met Flask moet draaien op **Vercel** (GitHub Pages alleen kan de Python-routes niet uitvoeren).
2. Vercel: Settings → Environment Variables: voeg `OPENAI_API_KEY` toe.
3. Optioneel: `OPENAI_MODEL=gpt-4.1-mini`, `OPENAI_IMAGE_MODEL=gpt-image-2.5-flare` en `INTERVIEW_MAX_QUESTIONS=0` (alle vragen). Voor een korte test: `INTERVIEW_MAX_QUESTIONS=6`.
4. Een oude `ASSISTANT_ID` is niet nodig. Redeploy en test een volledig gesprek, een CSV-download en de twee outputs.
5. Voor afbeeldingen moet je OpenAI-account toegang hebben tot het gekozen afbeeldingsmodel. Generatie kost extra en kan langer duren; controleer zo nodig in Vercel **Functions → Max Duration**. Zie [Images API](https://developers.openai.com/api/docs/guides/image-generation).

## Lokaal

```bash
python -m pip install -r requirements.txt
cp .env.example .env
# Zet een echte OpenAI API-sleutel in .env
python main.py
```

Open http://localhost:8080. De CSV-vragen volgen standaard **alle 23 vragen** in bronvolgorde. De keuzevolgorde kan later adaptief worden gemaakt, zonder de bron-CSV te veranderen. De 'afsluiting'-regel is geen interviewvraag.

## Validatie en privacy

- Server: keuzeopties, schaal 1 t/m 5, formaat geboortejaar en viercijferige postcode. Het **bestaan** van een postcode of OBA-vestiging wordt **niet** betrouwbaar extern geverifieerd. Dat vraagt een officiële en actuele referentiedataset.
- Assistent: verduidelijking bij onzinnige/onbegrijpelijke open antwoorden, geen validatie om kritiek weg te filteren.
- Bepaal vóór livegang bewaartermijn en privacy-informatie. Deelname kan geboortemaand, postcode en gender omvatten; deelnemer kan `sla over` / `skip` typen. Persoonsgegevens worden bewust niet in creatieve outputprompts opgenomen.
- CSV bevat alle antwoorden, inclusief optionele persoonsgegevens, en is alleen een **deelnemersdownload**, geen centrale onderzoeksdatabase.
- OpenAI-conversaties houden gespreksdata bij; raadpleeg het actuele OpenAI privacy-/retentiebeleid en vraag passende toestemming.
- De browser bewaart de antwoorden alleen in het actieve tabblad, niet blijvend. Herstart maakt een nieuwe sessie.
- Geen OpenAI API-key of `.env` op GitHub plaatsen.

## Grenzen

- De oorspronkelijke ‘START’ / ‘QUESTIONDB’ handdruk is een protocol van de oude Assistant, niet nodig bij de nieuwe Responses API. `/start` laadt nu het CSV-bestand rechtstreeks.
- Gesprek in het Engels toont een AI-vertaling van vragen én zichtbare keuzeopties; de opgeslagen waarden blijven de oorspronkelijke CSV-opties. Test vertalingen vooraf bij echte respondenten.
- Er is geen beheerdersportaal of centrale opslag ingericht. Productiegebruik met grote aantallen bezoekers vereist aanvullende beveiliging tegen misbruik en rate limiting.
- De OpenAI-modellen en Vercel hebben geen live test gekregen met jouw sleutel/omgeving.

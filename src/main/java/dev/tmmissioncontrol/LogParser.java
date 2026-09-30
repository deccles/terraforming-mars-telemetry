package dev.tmmissioncontrol;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class LogParser {
    private static final Pattern PLAYING_CARD = Pattern.compile(
            "Playing(?: action)? \\((\\d+(?:\\.\\d+)*)\\) CardPlayerAction Card: (.+)$");
    private static final Pattern CONFIRM_PLAY = Pattern.compile(
            "Do you want to play: (.+)\\??$");
    private static final Pattern PLAYER_PLAYS_ID = Pattern.compile(
            "\\[PlayerAction] Player (\\d+) plays the card (\\d+)");
    private static final Pattern PLAYER_PLAY = Pattern.compile(
            "\\[PlayerAction] Player (\\d+) Play for player (\\d+)");
    private static final Pattern TRAY = Pattern.compile("Setting tray to player (\\d+)");
    private static final Pattern CURRENT_PLAYER = Pattern.compile("CurrentPlayerLocalId: (\\d+)");
    private static final Pattern PLACE_TILE = Pattern.compile(
            "PlaceTile => Type: \\(([^)]+)\\).*Place tile (\\S+) on id (-?\\d+)");
    private static final Pattern RESOURCE = Pattern.compile(
            "\\[PlayerResources] Set (MegaCredit|Steel|Titanium|Plant|Energy|Heat) (quantity|production) from (-?\\d+) to (-?\\d+)");
    private static final Pattern TR = Pattern.compile(
            "\\[BoardDatas] Set terraforming rating for player (\\d+), from (-?\\d+) to (-?\\d+)");
    private static final Pattern GENERATION = Pattern.compile("Increment Generation to (\\d+)");
    private static final Pattern PHASE = Pattern.compile("GameSM enters (\\w+)");
    private static final Pattern GAME_ID = Pattern.compile("^GameID: (.+)$");
    private static final Pattern BOARD = Pattern.compile("^BoardType: (.+)$");
    private static final Pattern PLAYER_HEADER = Pattern.compile("^Player (\\d+)$");
    private static final Pattern AGENT = Pattern.compile("^AgentType: (.+)$");
    private static final Pattern PLAYER_NAME = Pattern.compile("^Name: (.+)$");
    private static final Pattern CORP_ID = Pattern.compile("^\\tCorporation : (\\d+)$");
    private static final Pattern MILESTONE = Pattern.compile(
            "\\[PlayerAction] Playing(?: action)? \\(\\d+\\) Milestone Action: (.+)$");
    private static final Pattern MILESTONE_LISTED = Pattern.compile(
            "\\[PlayerAction] Adding action \\(\\d+\\) Milestone Action: (.+)$");
    private static final Pattern AWARD = Pattern.compile(
            "\\[PlayerAction] Playing(?: action)? \\(\\d+\\) Award Action: (.+)$");
    private static final Pattern STANDARD = Pattern.compile(
            "Playing(?: action)? \\((\\d+(?:\\.\\d+)*)\\) Standard Project: (.+)$");
    private static final Pattern BLUE_ACTION = Pattern.compile(
            "Playing(?: action)? \\((\\d+(?:\\.\\d+)*)\\) Blue Card Action : (.+)$");
    private static final Pattern CORP_ACTION = Pattern.compile(
            "Playing(?: action)? \\((\\d+(?:\\.\\d+)*)\\) Corporation action : (.+)$");
    private static final Pattern PLACE_TILE_ACTION = Pattern.compile(
            "Playing action \\(([\\d.]+)\\) Place(Ocean|City|Greenery|Generic)TilePlayerAction");
    private static final Pattern CONVERSION = Pattern.compile(
            "Playing(?: action)? \\(([\\d.]+)\\) (?:Last)?(Plant|Heat)ConversionPlayerAction");
    private static final Pattern CARD_TOKEN = Pattern.compile(
            "\\[PlayerResources] (Adding|Removing) (-?\\d+) (\\w+) (?:to|from) (\\d+)");
    private static final Pattern CORP_CITY = Pattern.compile(
            "\\[PlayerAction] (?:Adding|Playing) action \\((\\d+)\\) PlaceCityTilePlayerAction");
    private static final Pattern ASKING_PLAYER = Pattern.compile(
            "asking for input for player (\\d+)");
    private static final Pattern TAB_PLAYER = Pattern.compile("Tab_Player_(\\d+)");
    private static final Pattern STARTING_CARD_PLAYER = Pattern.compile(
            "StartingCardEvent\\tPlayerLocalID : (\\d+)");
    private static final Pattern ADDING_CORP_ACTION = Pattern.compile(
            "\\[PlayerAction] Adding action \\(\\d+\\) Corporation action : (.+)$");
    private static final Pattern TO_PLAYER_BANK = Pattern.compile("to player (\\d+) bank");
    private static final Pattern DRAW_CARDS = Pattern.compile(
            "\\[PlayerAction] Playing(?: action)? \\([\\d.]+\\) DrawCardPlayerAction");
    private static final Pattern ADDING_HAND_CARD = Pattern.compile(
            "\\[PlayerAction] Adding action \\([\\d.]+\\) CardPlayerAction Card: (.+)$");
    private static final Pattern STAMP = Pattern.compile("^\\[([\\d.,]+)]");
    /** Chat lines carry wall-clock time (local), e.g. "[6.506]... ChatEntry ... Time 9/27/2026 9:37:14 PM". */
    private static final Pattern CHAT_CLOCK = Pattern.compile(
            "^\\[([\\d,]+\\.\\d+)].*\\bTime (\\d{1,2}/\\d{1,2}/\\d{4} \\d{1,2}:\\d{2}:\\d{2} [AP]M)");
    private static final java.time.format.DateTimeFormatter CHAT_TIME =
            java.time.format.DateTimeFormatter.ofPattern("M/d/yyyy h:mm:ss a", java.util.Locale.US);

    private final CardDatabase cards;
    private final GameState state;

    private int currentPlayer = 1;
    private int resourcePlayer = 0;
    private int headerPlayer = 0;
    private boolean inHeader;
    private int pendingCorpMc = -1;
    private int pendingCorpPlayer = 0;
    private int pendingSteamCorpId = -1;
    private String pendingNamedCorp = "";
    private List<Card> pendingCorps = List.of();
    private String lastCardKey = "";
    private String lastBlueAction = "";
    private boolean collectDraws;
    private String pendingHandCard = "";
    private String lastLogKey = "";
    /** When the game client launched (epoch millis), learned from a chat clock line; the log itself has no dates. */
    long launchEpochMs = -1;
    private final java.util.Map<Integer, String> steamCorps = new java.util.HashMap<>();

    public LogParser(CardDatabase cards, GameState state) {
        this.cards = cards;
        this.state = state;
    }

    public void replay(Path logFile) throws Exception {
        launchEpochMs = -1; // a replay is a new client session; don't carry the last one's launch time
        int startLine = lastGameLine(logFile);
        try (var reader = Files.newBufferedReader(logFile, StandardCharsets.UTF_8)) {
            int lineNo = 0;
            String line;
            while ((line = reader.readLine()) != null) {
                lineNo++;
                if (lineNo >= startLine) {
                    consume(line);
                } else {
                    noteClock(line); // the launch-time anchor usually comes before the game starts
                }
            }
        }
    }

    static int lastGameLine(Path logFile) throws Exception {
        int lineNo = 0;
        int last = 1;
        try (var reader = Files.newBufferedReader(logFile, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineNo++;
                if (line.contains("Created new Game")) {
                    last = lineNo;
                }
            }
        }
        return last;
    }

    public void consume(String line) {
        if (line == null || line.isBlank()) {
            return;
        }
        synchronized (state.lock()) {
            noteClock(line);
            if (line.contains("Created new Game")) {
                state.reset();
                state.createdElapsed = elapsedOf(line);
                applyStartTime();
                currentPlayer = 1;
                resourcePlayer = 0;
                headerPlayer = 0;
                inHeader = true;
                pendingCorpMc = -1;
                pendingCorps = List.of();
                pendingCorpPlayer = 0;
                pendingSteamCorpId = -1;
                pendingNamedCorp = "";
                lastCardKey = "";
                lastBlueAction = "";
                collectDraws = false;
                pendingHandCard = "";
                lastLogKey = "";
                steamCorps.clear();
                return;
            }
            parseHeader(line);
            Matcher m;

            m = TRAY.matcher(line);
            if (m.find()) {
                setCurrentPlayer(Integer.parseInt(m.group(1)));
            }
            m = CURRENT_PLAYER.matcher(line);
            if (m.find()) {
                setCurrentPlayer(Integer.parseInt(m.group(1)));
            }
            m = PLAYER_PLAY.matcher(line);
            if (m.find()) {
                setCurrentPlayer(Integer.parseInt(m.group(1)));
                resourcePlayer = Integer.parseInt(m.group(2));
            }
            m = PLAYER_PLAYS_ID.matcher(line);
            if (m.find()) {
                setCurrentPlayer(Integer.parseInt(m.group(1)));
            }
            m = TAB_PLAYER.matcher(line);
            if (m.find()) {
                int tabId = Integer.parseInt(m.group(1));
                rememberTurnOrder(tabId);
                if (productionPhase()) {
                    setCurrentPlayer(tabId);
                }
            }
            m = STARTING_CARD_PLAYER.matcher(line);
            if (m.find()) {
                setCurrentPlayer(Integer.parseInt(m.group(1)));
            }

            m = ADDING_CORP_ACTION.matcher(line);
            if (m.find()) {
                pendingNamedCorp = m.group(1).trim();
            } else if (line.contains("[PlayerAction] Adding action")) {
                pendingNamedCorp = "";
            }
            m = TO_PLAYER_BANK.matcher(line);
            if (m.find()) {
                int bankPlayer = Integer.parseInt(m.group(1));
                if (collectDraws && !pendingHandCard.isBlank()) {
                    if (state.player(bankPlayer).human) {
                        addDrawn(pendingHandCard);
                        logDrawn(bankPlayer, pendingHandCard);
                    }
                    pendingHandCard = "";
                }
                if (!pendingNamedCorp.isBlank()) {
                    Card named = cards.find(pendingNamedCorp);
                    if (named != null) {
                        assignCorp(state.player(bankPlayer), named);
                    }
                    pendingNamedCorp = "";
                }
            }

            m = GAME_ID.matcher(line.trim());
            if (m.matches()) {
                state.gameId = m.group(1).trim();
            }
            m = BOARD.matcher(line.trim());
            if (m.matches()) {
                state.board = m.group(1).trim();
            }
            m = GENERATION.matcher(line);
            if (m.find()) {
                int next = Integer.parseInt(m.group(1));
                if (next > state.generation) {
                    state.recordGenerationEnd();
                    lastBlueAction = "";
                    state.generation = next;
                }
            }
            m = PHASE.matcher(line);
            if (m.find()) {
                state.phase = humanPhase(m.group(1));
                resourcePlayer = 0;
                if (state.phase.toLowerCase().contains("endgame")) {
                    state.recordGenerationEnd();
                }
                if ("Actions".equals(state.phase)
                        && (corpTaken("Tharsis Republic") || state.generation > 1)) {
                    resolveLeftoverCorps();
                }
            }

            m = TR.matcher(line);
            if (m.find()) {
                int playerId = Integer.parseInt(m.group(1));
                int from = Integer.parseInt(m.group(2));
                int to = Integer.parseInt(m.group(3));
                PlayerState p = state.player(playerId);
                p.tr = to;
                if (from > 0 && to != from) {
                    state.addScoreEvent(playerId, "tr", causeFor(p), to - from);
                }
            }

            m = CORP_ID.matcher(line);
            if (m.matches()) {
                pendingCorpPlayer = currentPlayer;
                pendingCorpMc = -1;
                pendingCorps = List.of();
                pendingSteamCorpId = Integer.parseInt(m.group(1));
                String known = SteamCorporations.nameFor(pendingSteamCorpId);
                if (known == null) {
                    known = steamCorps.get(pendingSteamCorpId);
                }
                if (known != null) {
                    steamCorps.put(pendingSteamCorpId, known);
                    assignCorpByName(state.player(pendingCorpPlayer), known);
                }
            }

            m = RESOURCE.matcher(line);
            if (m.find()) {
                applyResource(m.group(1), m.group(2), Integer.parseInt(m.group(3)), Integer.parseInt(m.group(4)));
            }

            m = CARD_TOKEN.matcher(line);
            if (m.find()) {
                int amount = Integer.parseInt(m.group(2));
                if ("Removing".equals(m.group(1))) {
                    amount = -Math.abs(amount);
                }
                addCardTokens(Integer.parseInt(m.group(4)), m.group(3), amount);
            }

            m = CONFIRM_PLAY.matcher(line);
            if (m.find()) {
                setActive(currentPlayer, m.group(1).trim(), null, true);
            }

            m = PLAYING_CARD.matcher(line);
            if (m.find()) {
                collectDraws = false;
                pendingHandCard = "";
                playCard(currentPlayer, m.group(2).trim());
            }
            if (DRAW_CARDS.matcher(line).find() && !line.contains("Adding action")) {
                beginDrawCollect();
            }
            m = ADDING_HAND_CARD.matcher(line);
            if (m.find() && collectDraws) {
                pendingHandCard = m.group(1).trim();
            }
            if (line.contains("finished handling event of type:")) {
                collectDraws = false;
                pendingHandCard = "";
            }

            m = STANDARD.matcher(line);
            if (m.find()) {
                collectDraws = false;
                pendingHandCard = "";
                lastBlueAction = "";
                setActive(currentPlayer, "Standard Project: " + m.group(2).trim(), null, false);
                logMove(line, currentPlayer, "project", m.group(2).trim(), "");
            }

            m = BLUE_ACTION.matcher(line);
            if (m.find() && !line.contains("Adding action")) {
                lastBlueAction = cards.displayName(m.group(2).trim());
                markActionUsed(m.group(2).trim());
                logMove(line, currentPlayer, "action", lastBlueAction, "");
                setActive(currentPlayer, "Using " + m.group(2).trim(), null, false);
            }
            m = CORP_ACTION.matcher(line);
            if (m.find() && !line.contains("Adding action")) {
                lastBlueAction = "";
                setActive(currentPlayer, "Using " + m.group(2).trim(), null, false);
                logMove(line, currentPlayer, "corp-action", m.group(2).trim(), "");
            }
            m = CONVERSION.matcher(line);
            if (m.find() && !line.contains("Adding action")) {
                lastBlueAction = "";
                startConversion(m.group(2));
                logMove(line, currentPlayer, "convert", m.group(2), "");
            }
            m = PLACE_TILE_ACTION.matcher(line);
            if (m.find()) {
                pinPlacement(m.group(2));
            }

            m = ASKING_PLAYER.matcher(line);
            if (m.find()) {
                setCurrentPlayer(Integer.parseInt(m.group(1)));
            }
            m = CORP_CITY.matcher(line);
            if (m.find() && Integer.parseInt(m.group(1)) != 5 && state.generation <= 1) {
                assignTharsisIfPending();
            }

            m = PLACE_TILE.matcher(line);
            if (m.find()) {
                onPlace(m.group(1), Integer.parseInt(m.group(3)));
            }
            if (line.contains(":: PlaceTile") && line.contains("Callback is called")) {
                collectDraws = false;
                pendingHandCard = "";
            }

            m = MILESTONE_LISTED.matcher(line);
            if (m.find()) {
                state.listedMilestones.add(m.group(1).trim());
            }
            m = MILESTONE.matcher(line);
            if (m.find() && !line.contains("Playing action")) {
                lastBlueAction = "";
                String name = m.group(1).trim();
                PlayerState claimer = state.player(currentPlayer);
                if (!claimer.milestones.contains(name)) {
                    claimer.milestones.add(name);
                    ScoreEvent event = state.addScoreEvent(currentPlayer, "milestone", "+5 " + name, 5);
                    if (event != null) {
                        event.source = "Milestone: " + name;
                    }
                    state.addLog(currentPlayer, "milestone", name, "");
                }
            }
            m = AWARD.matcher(line);
            if (m.find() && !line.contains("Playing action")) {
                lastBlueAction = "";
                String name = m.group(1).trim();
                state.player(currentPlayer).awards.add(name);
                ScoreEvent event = state.addScoreEvent(currentPlayer, "award", "funded " + name, 0);
                if (event != null) {
                    event.source = "Funded " + name;
                }
                logMove(line, currentPlayer, "award", name, "");
            }

            if (line.contains("ShowOpponentCardPage") && state.activePlay != null) {
                state.activePlay.yours = false;
            }
        }
    }

    private void parseHeader(String line) {
        String trimmed = line.trim();
        if (trimmed.equals("----- Game Info -----")) {
            inHeader = true;
            return;
        }
        if (trimmed.equals("---------------------")) {
            inHeader = false;
            headerPlayer = 0;
            PlayerColors.apply(state);
            return;
        }
        if (!inHeader) {
            return;
        }
        Matcher m = PLAYER_HEADER.matcher(trimmed);
        if (m.matches()) {
            headerPlayer = Integer.parseInt(m.group(1));
            PlayerState seated = state.player(headerPlayer);
            seated.seated = true;
            seated.color = PlayerState.colorFor(headerPlayer);
            return;
        }
        if (trimmed.startsWith("Prelude Phase:")) {
            state.prelude = trimmed.endsWith("True");
            return;
        }
        if (trimmed.startsWith("VenusNext:")) {
            state.venus = trimmed.endsWith("True");
            return;
        }
        if (trimmed.startsWith("Colonies:")) {
            state.colonies = trimmed.endsWith("True");
            return;
        }
        if (headerPlayer == 0) {
            return;
        }
        m = PLAYER_NAME.matcher(trimmed);
        if (m.matches()) {
            String name = m.group(1).trim();
            if (name.matches("\\d+ Player")) {
                state.player(headerPlayer).name = "Player " + headerPlayer;
            } else {
                state.player(headerPlayer).name = name;
            }
            return;
        }
        if (trimmed.startsWith("AI - ")) {
            state.player(headerPlayer).name = trimmed;
            return;
        }
        m = AGENT.matcher(trimmed);
        if (m.matches()) {
            boolean human = m.group(1).equalsIgnoreCase("Human");
            state.player(headerPlayer).human = human;
            if (human) {
                state.humanId = headerPlayer;
            }
            return;
        }
        if (trimmed.startsWith("IsMe:")) {
            boolean me = trimmed.endsWith("True");
            PlayerState seated = state.player(headerPlayer);
            // Offline games also mark the AI seat IsMe. Only a human agent is the local player.
            if (me && !seated.human) {
                return;
            }
            seated.human = me;
            if (me) {
                state.humanId = headerPlayer;
            } else if (state.humanId == headerPlayer) {
                state.humanId = otherHuman(headerPlayer);
            }
            if (!me && "You".equals(seated.name)) {
                seated.name = "Player " + headerPlayer;
            }
        }
    }

    private int otherHuman(int exceptId) {
        for (PlayerState player : state.players.values()) {
            if (player.id != exceptId && player.human) {
                return player.id;
            }
        }
        return 1;
    }

    private void applyResource(String kind, String qtyOrProd, int from, int to) {
        boolean production = "production".equals(qtyOrProd);
        PlayerState target;
        if (pendingCorpPlayer > 0 && !production && "MegaCredit".equals(kind) && from == 0
                && "Unknown".equals(state.player(pendingCorpPlayer).corporation)) {
            target = state.player(pendingCorpPlayer);
        } else if (resourcePlayer > 0) {
            target = state.player(resourcePlayer);
        } else {
            target = findOwner(kind, production, from, to);
            if (target == null) {
                target = state.player(currentPlayer);
            }
        }
        setField(target, kind, production, to);
        if (!production && "MegaCredit".equals(kind) && from == 0) {
            if (target.startingMc < 0) {
                target.startingMc = to;
            }
            if ("Unknown".equals(target.corporation)) {
                identifyCorpByMc(target, to);
            }
        }
        if (!production && pendingCorps.size() > 1 && target.id == pendingCorpPlayer) {
            refineCorpByResource(target, kind, to);
        }
        if (production && pendingCorps.size() > 1 && "Unknown".equals(target.corporation)) {
            refineCorpByProduction(target, kind, to);
        }
        // Every seat starts with production set 0 → 1 before the game begins; that isn't a cause.
        boolean initialSet = from == 0 && "Setup".equals(state.phase);
        if (production && to != from && !initialSet && !productionPhase()) {
            state.addScoreEvent(target.id, "prod-" + prodKey(kind), causeFor(target), to - from);
        }
    }

    private static String prodKey(String kind) {
        return switch (kind) {
            case "MegaCredit" -> "mc";
            case "Titanium" -> "ti";
            default -> kind.toLowerCase();
        };
    }

    /** What the log is resolving right now, named for the chart detail. */
    private String causeFor(PlayerState target) {
        ActivePlay play = state.activePlay;
        if (play == null || play.cardName == null || play.cardName.isBlank()) {
            if (state.generation <= 1 && !"Unknown".equals(target.corporation)) {
                return target.corporation;
            }
            return "Other";
        }
        String name = play.cardName;
        if (name.startsWith("Using ")) {
            name = name.substring(6) + " action";
        } else if ("Action".equals(play.colorLabel)) {
            // setActive strips "Using " from card actions and marks them with the Action label.
            name = name + " action";
        } else if (name.startsWith("Standard Project: ")) {
            name = "Standard project: " + name.substring(18);
        } else if (name.startsWith("Placing ")) {
            name = name.substring(8) + " placement";
        }
        if (play.playerId != target.id) {
            name += " (" + state.player(play.playerId).displayName() + ")";
        }
        return name;
    }

    private void identifyCorpByMc(PlayerState player, int mc) {
        List<Card> matches = new ArrayList<>();
        for (Card corp : cards.corpsWithStartingMc(mc, state.prelude, state.venus, state.colonies)) {
            if (!corpTaken(corp.name)) {
                matches.add(corp);
            }
        }
        pendingCorpPlayer = player.id;
        pendingCorpMc = mc;
        pendingCorps = matches;
        player.startingMc = mc;
        if (matches.size() == 1) {
            assignCorp(player, matches.get(0));
            if (pendingSteamCorpId > 0) {
                steamCorps.put(pendingSteamCorpId, matches.get(0).name);
            }
        }
    }

    private void refineCorpByResource(PlayerState player, String kind, int to) {
        String key = switch (kind) {
            case "Steel" -> "steel";
            case "Titanium" -> "ti";
            case "Plant" -> "plant";
            default -> "";
        };
        if (key.isEmpty()) {
            return;
        }
        for (Card corp : pendingCorps) {
            if (CardDatabase.number(corp.resources.get(key)) == to) {
                assignCorp(player, corp);
                return;
            }
        }
    }

    private void refineCorpByProduction(PlayerState player, String kind, int to) {
        String key = switch (kind) {
            case "Heat" -> "heat";
            case "Energy" -> "energy";
            case "Steel" -> "steel";
            case "Titanium" -> "ti";
            case "Plant" -> "plant";
            case "MegaCredit" -> "mc";
            default -> "";
        };
        if (key.isEmpty()) {
            return;
        }
        for (Card corp : pendingCorps) {
            int extra = CardDatabase.number(corp.production.get(key));
            if (extra > 0 && to == 1 + extra) {
                assignCorp(player, corp);
                return;
            }
        }
    }

    private void rememberTurnOrder(int playerId) {
        int seated = 0;
        for (PlayerState player : state.players.values()) {
            if (player.seated) {
                seated++;
            }
        }
        if (seated == 0 || state.playerOrder.size() >= seated) {
            return;
        }
        if (!state.playerOrder.contains(playerId)) {
            state.playerOrder.add(playerId);
        }
    }

    private boolean corpTaken(String name) {
        for (PlayerState p : state.players.values()) {
            if (name.equals(p.corporation)) {
                return true;
            }
        }
        return false;
    }

    private void assignTharsisIfPending() {
        Card tharsis = cards.find("Tharsis Republic");
        if (tharsis == null || corpTaken(tharsis.name)) {
            resolveLeftoverCorps();
            return;
        }
        PlayerState player = state.player(currentPlayer);
        if (!"Unknown".equals(player.corporation)) {
            return;
        }
        if (player.startingMc != 40 && player.startingMc != -1) {
            return;
        }
        assignCorp(player, tharsis);
        resolveLeftoverCorps();
    }

    private void resolveLeftoverCorps() {
        if (!corpTaken("Tharsis Republic") && state.generation < 2) {
            return;
        }
        Card unmi = cards.find("United Nations Mars Initiative");
        if (unmi == null) {
            return;
        }
        for (PlayerState p : state.players.values()) {
            if ("Unknown".equals(p.corporation) && p.startingMc == 40) {
                assignCorp(p, unmi);
            }
        }
    }

    private void assignCorpByName(PlayerState player, String name) {
        Card corp = cards.find(name);
        if (corp != null) {
            assignCorp(player, corp);
            return;
        }
        pendingCorps = List.of();
        pendingCorpMc = -1;
        if (!"Unknown".equals(player.corporation)) {
            return;
        }
        player.corporation = name;
    }

    private void assignCorp(PlayerState player, Card corp) {
        pendingCorps = List.of();
        pendingCorpMc = -1;
        if (!"Unknown".equals(player.corporation)) {
            return;
        }
        player.corporation = corp.name;
        player.corpRules = corp.extra == null ? "" : corp.extra;
        for (String tag : corp.tags) {
            player.addTag(tag);
        }
    }

    private PlayerState findOwner(String kind, boolean production, int from, int to) {
        List<PlayerState> matches = new ArrayList<>();
        for (PlayerState p : state.players.values()) {
            if (getField(p, kind, production) == from) {
                matches.add(p);
            }
        }
        if (matches.size() == 1) {
            return matches.get(0);
        }
        PlayerState byCorpStart = ownerByCorpStart(kind, production, from, to, matches);
        if (byCorpStart != null) {
            return byCorpStart;
        }
        PlayerState current = state.players.get(currentPlayer);
        if (current != null && getField(current, kind, production) == from) {
            return current;
        }
        if (productionPhase() && current != null) {
            return current;
        }
        return matches.isEmpty() ? current : matches.get(0);
    }

    private PlayerState ownerByCorpStart(String kind, boolean production, int from, int to,
            List<PlayerState> matches) {
        String key = switch (kind) {
            case "MegaCredit" -> "mc";
            case "Steel" -> "steel";
            case "Titanium" -> "ti";
            case "Plant" -> "plant";
            case "Energy" -> "energy";
            case "Heat" -> "heat";
            default -> "";
        };
        if (key.isEmpty()) {
            return null;
        }
        for (PlayerState player : matches) {
            if ("Unknown".equals(player.corporation)) {
                continue;
            }
            Card corp = cards.find(player.corporation);
            if (corp == null) {
                continue;
            }
            if (production) {
                int extra = CardDatabase.number(corp.production.get(key));
                if (extra > 0 && from + extra == to) {
                    return player;
                }
            } else {
                int start = CardDatabase.number(corp.resources.get(key));
                if (start > 0 && from == 0 && to == start) {
                    return player;
                }
            }
        }
        return null;
    }

    private boolean productionPhase() {
        String phase = state.phase;
        return "Production".equals(phase) || "FinalPlantConversion".equals(phase);
    }

    private static int getField(PlayerState p, String kind, boolean production) {
        return switch (kind) {
            case "MegaCredit" -> production ? p.megaCreditProd : p.megaCredits;
            case "Steel" -> production ? p.steelProd : p.steel;
            case "Titanium" -> production ? p.titaniumProd : p.titanium;
            case "Plant" -> production ? p.plantProd : p.plants;
            case "Energy" -> production ? p.energyProd : p.energy;
            case "Heat" -> production ? p.heatProd : p.heat;
            default -> 0;
        };
    }

    private static void setField(PlayerState p, String kind, boolean production, int to) {
        switch (kind) {
            case "MegaCredit" -> {
                if (production) p.megaCreditProd = to;
                else p.megaCredits = to;
            }
            case "Steel" -> {
                if (production) p.steelProd = to;
                else p.steel = to;
            }
            case "Titanium" -> {
                if (production) p.titaniumProd = to;
                else p.titanium = to;
            }
            case "Plant" -> {
                if (production) p.plantProd = to;
                else p.plants = to;
            }
            case "Energy" -> {
                if (production) p.energyProd = to;
                else p.energy = to;
            }
            case "Heat" -> {
                if (production) p.heatProd = to;
                else p.heat = to;
            }
            default -> {
            }
        }
    }

    private void playCard(int playerId, String rawName) {
        String key = playerId + "|" + CardDatabase.normalize(rawName);
        if (key.equals(lastCardKey)) {
            return;
        }
        lastCardKey = key;
        lastBlueAction = "";
        Card card = cards.find(rawName);
        String name = cards.displayName(rawName);
        PlayerState player = state.player(playerId);
        PlayedCard played = new PlayedCard();
        played.name = name;
        played.generation = state.generation;
        if (card != null) {
            played.color = card.color;
            played.colorLabel = card.colorLabel();
            played.tags = List.copyOf(card.tags);
            played.extra = card.extra;
            played.blue = card.isBlue();
            played.number = CardDatabase.parseCardNumber(card.number);
            played.tokenType = cards.tokenType(card);
            played.printedVp = card.vp == null ? 0 : card.vp;
            played.hasRequirement = card.hasRequirement();
            played.cost = card.cost;
            if (card.resources != null) played.resources = new java.util.LinkedHashMap<>(card.resources);
            if (card.production != null) played.production = new java.util.LinkedHashMap<>(card.production);
            if (card.req != null) played.req = new java.util.LinkedHashMap<>(card.req);
            if (card.place != null) played.place = List.copyOf(card.place);
            played.project = !"prel".equalsIgnoreCase(card.type)
                    && !"corp".equalsIgnoreCase(card.type)
                    && !card.isEvent();
        } else {
            played.color = "green";
            played.colorLabel = "";
            played.blue = false;
            played.project = true;
        }
        player.addCard(played);
        state.addLog(playerId, "card", name, played.color);
        int vp = ScoreCalculator.cardVp(played, player, citiesInPlay());
        if (vp != 0) {
            String sign = vp > 0 ? "+" : "";
            ScoreEvent event = state.addScoreEvent(playerId, "card", sign + vp + " " + name, vp);
            if (event != null) {
                event.source = name;
            }
        }
        setActive(playerId, name, null, false);
        setCurrentPlayer(playerId);
    }

    /** Seconds since the client launched, from a line's "[1,095.771]" stamp; -1 when it has none. */
    static double elapsedOf(String line) {
        Matcher ts = STAMP.matcher(line);
        if (!ts.find()) {
            return -1;
        }
        try {
            return Double.parseDouble(ts.group(1).replace(",", ""));
        } catch (NumberFormatException ex) {
            return -1;
        }
    }

    /** The client's launch time implied by a chat line's wall-clock time, or -1 if the line has none. */
    static long launchFrom(String line) {
        if (!line.contains(" Time ")) {
            return -1;
        }
        Matcher m = CHAT_CLOCK.matcher(line);
        if (!m.find()) {
            return -1;
        }
        try {
            double elapsed = Double.parseDouble(m.group(1).replace(",", ""));
            long clock = java.time.LocalDateTime.parse(m.group(2), CHAT_TIME)
                    .atZone(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli();
            return clock - Math.round(elapsed * 1000);
        } catch (Exception ex) {
            return -1;
        }
    }

    void noteClock(String line) {
        long launch = launchFrom(line);
        if (launch > 0) {
            launchEpochMs = launch;
            applyStartTime();
        }
    }

    private void applyStartTime() {
        if (launchEpochMs > 0 && state.createdElapsed >= 0 && state.startedAtMs < 0) {
            state.startedAtMs = launchEpochMs + Math.round(state.createdElapsed * 1000);
        }
    }

    /**
     * The game writes most moves twice, on lines with the same timestamp ("Playing action (5) ..." then
     * "Playing (5) ..."); log a move once per timestamp so a real repeat (two City projects) still counts.
     */
    private void logMove(String line, int playerId, String kind, String name, String color) {
        Matcher ts = STAMP.matcher(line);
        String key = (ts.find() ? ts.group(1) : "") + "|" + playerId + "|" + kind + "|" + name;
        if (key.equals(lastLogKey)) {
            return;
        }
        lastLogKey = key;
        state.addLog(playerId, kind, name, color);
    }

    /**
     * Put a drawn card on the player's latest move this generation: the card, project, conversion, or action
     * whose effect or tile placement drew it. Action phase only, so research-phase buys aren't pinned to the
     * previous generation's last move.
     */
    private void logDrawn(int playerId, String rawName) {
        if (!"Actions".equals(state.phase)) {
            return;
        }
        String name = cards.displayName(rawName);
        for (int i = state.playLog.size() - 1; i >= 0; i--) {
            LogEntry entry = state.playLog.get(i);
            if (entry.generation != state.generation) {
                return;
            }
            if (entry.playerId == playerId) {
                if (entry.drawn.stream().noneMatch(d -> name.equals(d.name))) {
                    entry.drawn.add(drawnCard(rawName));
                }
                return;
            }
        }
    }

    /**
     * A blue card belongs to one player, so match by name across the table. The log's number in
     * "Playing action (129) Blue Card Action : ..." is an action id, not the card number.
     */
    private void markActionUsed(String rawName) {
        String want = CardDatabase.normalize(cards.displayName(rawName));
        for (PlayerState player : state.players.values()) {
            for (PlayedCard card : player.blueCards) {
                if (CardDatabase.normalize(card.name).equals(want)) {
                    card.actionUsedGen = state.generation;
                    return;
                }
            }
        }
    }

    private void addCardTokens(int cardNumber, String rawType, int amount) {
        PlayedCard card = state.cardByNumber(cardNumber);
        PlayerState owner = state.ownerOfCard(cardNumber);
        if (card == null || owner == null) {
            return;
        }
        String type = switch (rawType.toLowerCase()) {
            case "microbe", "microbes" -> "microbe";
            case "animal", "animals" -> "animal";
            case "science" -> "science";
            case "fighter", "fighters" -> "fighter";
            case "floater", "floaters" -> "floater";
            default -> rawType.toLowerCase();
        };
        if (card.tokenType == null || card.tokenType.isBlank()) {
            card.tokenType = type;
        }
        int cities = citiesInPlay();
        int before = ScoreCalculator.cardVp(card, owner, cities);
        card.tokens = Math.max(0, card.tokens + amount);
        int after = ScoreCalculator.cardVp(card, owner, cities);
        int delta = after - before;
        if (amount != 0) {
            String sign = amount > 0 ? "+" : "";
            String label = sign + amount + " " + card.name;
            if (amount < 0 && !lastBlueAction.isBlank()) {
                label += " (" + lastBlueAction + ")";
            }
            ScoreEvent event = state.addScoreEvent(owner.id, "token", label, delta);
            if (event != null) {
                event.source = card.name;
                event.tokens = amount;
                event.tokenType = card.tokenType == null ? type : card.tokenType;
                event.cause = causeFor(owner);
            }
        }
    }

    private int citiesInPlay() {
        int n = 0;
        for (PlayerState p : state.players.values()) {
            n += p.cities;
        }
        if (n == 0) {
            for (PlayerState p : state.players.values()) {
                n += p.citiesOnMars;
            }
        }
        return n;
    }

    private void setCurrentPlayer(int playerId) {
        if (playerId == currentPlayer) {
            return;
        }
        currentPlayer = playerId;
        if (state.activePlay != null && state.activePlay.playerId != playerId) {
            if (state.activePlay.yours && !state.activePlay.drawn.isEmpty()) {
                state.activePlay.placing = null;
                return;
            }
            state.activePlay = null;
        }
    }

    private void startConversion(String kind) {
        PlayerState player = state.player(currentPlayer);
        if ("Heat".equals(kind)) {
            setActive(currentPlayer, "Convert heat", null, false);
            state.activePlay.colorLabel = "Conversion";
            state.activePlay.effect = "Spend 8 heat to raise temperature 1 step.";
            state.activePlay.remember = new ArrayList<>(List.of("Raises temperature and TR."));
            return;
        }
        boolean ecoline = "Ecoline".equals(player.corporation);
        int plants = ecoline ? 7 : 8;
        setActive(currentPlayer, "Convert plants", "Greenery", false);
        state.activePlay.colorLabel = "Conversion";
        state.activePlay.effect = "Spend " + plants + " plants to place a greenery.";
        state.activePlay.remember = new ArrayList<>(cards.remember(null, "Greenery"));
        if (ecoline) {
            state.activePlay.remember.add(0, "Ecoline: 7 plants instead of 8.");
        }
    }

    private void beginDrawCollect() {
        PlayerState player = state.player(currentPlayer);
        if (!player.human) {
            collectDraws = false;
            pendingHandCard = "";
            return;
        }
        collectDraws = true;
        pendingHandCard = "";
        if (state.activePlay == null || !state.activePlay.yours) {
            setActive(currentPlayer, "Draw cards", null, false);
            if (state.activePlay != null) {
                state.activePlay.colorLabel = "Draw";
                state.activePlay.effect = "Cards added to your hand.";
            }
        }
    }

    private void addDrawn(String rawName) {
        if (state.activePlay == null || !state.activePlay.yours) {
            return;
        }
        String name = cards.displayName(rawName);
        for (ActivePlay.DrawnCard existing : state.activePlay.drawn) {
            if (name.equals(existing.name)) {
                return;
            }
        }
        state.activePlay.drawn.add(drawnCard(rawName));
    }

    /** A drawn card with what the page needs to describe it (banner "Drew" list, game log popovers). */
    private ActivePlay.DrawnCard drawnCard(String rawName) {
        ActivePlay.DrawnCard drawn = new ActivePlay.DrawnCard();
        drawn.name = cards.displayName(rawName);
        Card card = cards.find(rawName);
        if (card != null) {
            drawn.color = card.color;
            drawn.cost = card.cost;
            drawn.vp = card.vp;
            drawn.tags = List.copyOf(card.tags);
            drawn.extra = card.extra == null ? "" : card.extra;
            if (card.production != null) {
                drawn.production = new java.util.LinkedHashMap<>(card.production);
            }
            if (card.resources != null) {
                drawn.resources = new java.util.LinkedHashMap<>(card.resources);
            }
            if (card.req != null) {
                drawn.req = new java.util.LinkedHashMap<>(card.req);
            }
            if (card.place != null) {
                drawn.place = List.copyOf(card.place);
            }
        }
        return drawn;
    }

    private void setActive(int playerId, String name, String placing, boolean preview) {
        PlayerState player = state.player(playerId);
        String lookup = name.startsWith("Using ") ? name.substring(6) : name.replace("Standard Project: ", "");
        Card card = cards.find(lookup);
        ActivePlay play = new ActivePlay();
        play.playerId = playerId;
        play.playerLabel = player.label();
        play.cardName = name.startsWith("Standard Project:") ? name : cards.displayName(lookup);
        play.yours = player.human;
        play.colorLabel = name.startsWith("Using ")
                ? "Action"
                : (card != null ? card.colorLabel() : (preview ? "Confirming" : ""));
        play.playerColor = player.color;
        play.fromCard(card);
        play.effect = card != null ? cards.cardText(card) : (preview ? "Waiting for confirm." : "");
        play.placing = placing;
        play.remember.addAll(cards.remember(card, placing));
        if (preview && play.remember.isEmpty()) {
            play.remember.add("Confirming this card.");
        }
        state.activePlay = play;
        state.live = true;
    }

    private void pinPlacement(String kind) {
        if (state.activePlay == null || state.activePlay.playerId != currentPlayer) {
            setActive(currentPlayer, "Placing " + kind, kind, false);
            return;
        }
        state.activePlay.placing = kind;
        String lookup = state.activePlay.cardName == null ? "" : state.activePlay.cardName
                .replace("Using ", "")
                .replace("Standard Project: ", "")
                .replace("Placing ", "");
        Card card = cards.find(lookup);
        state.activePlay.remember = cards.remember(card, kind);
        if (card != null && (state.activePlay.effect == null || state.activePlay.effect.isBlank())) {
            state.activePlay.effect = cards.cardText(card);
        }
    }

    private void onPlace(String type, int hex) {
        PlayerState player = state.player(currentPlayer);
        String kind = type.toLowerCase().replace(" ", "").replace("_", "");
        String cardName = state.activePlay == null ? "" : state.activePlay.cardName;
        if (kind.contains("city") || "capital".equals(kind)) {
            player.cities++;
            if (!offMarsCity(cardName) && BoardLayout.onMars(hex)) {
                player.citiesOnMars++;
            }
        } else if (kind.contains("greenery")) {
            player.greeneries++;
        } else if (kind.contains("ocean")) {
            player.oceans++;
        } else {
            player.specialTiles++;
        }
        if (hex > 0) {
            placeOnBoard(hex, kind, cardName, player.id);
        }
        if ((kind.contains("city") || "capital".equals(kind)) && state.generation <= 1
                && !offMarsCity(cardName)) {
            assignTharsisIfPending();
        }
        if (player.human) {
            if (state.activePlay == null || !state.activePlay.yours) {
                String label = kind.contains("ocean") ? "Ocean"
                        : kind.contains("city") || "capital".equals(kind) ? "City"
                        : kind.contains("greenery") ? "Greenery"
                        : "tile";
                setActive(currentPlayer, "Placing " + label, kind, false);
                if (state.activePlay != null) {
                    state.activePlay.colorLabel = "Placement";
                }
            }
            collectDraws = true;
            pendingHandCard = "";
        }
        clearPlacing();
    }

    private void clearPlacing() {
        if (state.activePlay == null) {
            return;
        }
        state.activePlay.placing = null;
        String lookup = state.activePlay.cardName == null ? "" : state.activePlay.cardName
                .replace("Using ", "")
                .replace("Standard Project: ", "");
        Card card = cards.find(lookup);
        state.activePlay.remember = new ArrayList<>(cards.remember(card, null));
    }

    private void placeOnBoard(int hex, String kind, String cardName, int playerId) {
        PlacedTile tile = new PlacedTile();
        tile.hex = hex;
        String card = cardName == null ? "" : cardName.toLowerCase();
        if (card.contains("capital") || "capital".equals(kind)) {
            tile.type = "capital";
            tile.ownerId = playerId;
        } else if (card.contains("commercial district") || "commercialdistrict".equals(kind)) {
            tile.type = "commercialdistrict";
            tile.ownerId = playerId;
        } else if (kind.contains("city")) {
            tile.type = "city";
            tile.ownerId = playerId;
        } else if (kind.contains("greenery")) {
            tile.type = "greenery";
            tile.ownerId = playerId;
        } else if (kind.contains("ocean")) {
            tile.type = "ocean";
            tile.ownerId = 0;
        } else {
            tile.type = kind;
            tile.ownerId = playerId;
        }
        state.tiles.put(hex, tile);
    }

    private static boolean offMarsCity(String cardName) {
        if (cardName == null) {
            return false;
        }
        String n = cardName.toLowerCase();
        return n.contains("phobos") || n.contains("ganymede") || n.contains("luna") || n.contains("stanford");
    }

    private static String humanPhase(String raw) {
        return switch (raw) {
            case "ActionPhase" -> "Actions";
            case "ProductionPhase" -> "Production";
            case "ResearchPhase" -> "Research";
            case "PlayerOrderPhase" -> "Player order";
            case "PlayerSetup", "InitializationPhase" -> "Setup";
            case "SaveGameState" -> "Saving";
            default -> raw.replace("Phase", "").replace("State", "");
        };
    }
}

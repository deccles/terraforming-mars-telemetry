package dev.tmmissioncontrol;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One colony tile in play and its trade track, rebuilt from public moves: the marker starts at step 1,
 * climbs a step each Solar phase, and after a trade drops back to just past the colonies. Each trade in
 * the log also states the step it traded at, so the marker re-syncs then.
 */
public final class ColonyTile {
    /** What a tile pays: the trade track (steps 0-6), the colony bonus, and what wakes it up if it starts inactive. */
    record Rules(String resource, int[] track, int bonus, String bonusResource, String activatedBy) {
    }

    // From the Colonies rules. Callisto and Titan tracks match the trades in our logs; the rest are unconfirmed.
    private static final Map<String, Rules> RULES = Map.ofEntries(
            Map.entry("Callisto", new Rules("energy", new int[] {0, 2, 3, 5, 7, 10, 13}, 3, "energy", null)),
            Map.entry("Ceres", new Rules("steel", new int[] {1, 2, 3, 4, 6, 8, 10}, 2, "steel", null)),
            Map.entry("Enceladus", new Rules("microbes", new int[] {0, 1, 2, 3, 4, 4, 5}, 1, "microbe", "microbe")),
            Map.entry("Europa", new Rules("M€ production", new int[] {1, 1, 2, 2, 3, 3, 4}, 1, "M€", null)),
            Map.entry("Ganymede", new Rules("plants", new int[] {0, 1, 2, 3, 4, 5, 6}, 1, "plant", null)),
            Map.entry("Io", new Rules("heat", new int[] {2, 3, 4, 6, 8, 10, 13}, 2, "heat", null)),
            Map.entry("Luna", new Rules("M€", new int[] {1, 2, 4, 7, 10, 13, 17}, 2, "M€", null)),
            Map.entry("Miranda", new Rules("animals", new int[] {0, 1, 1, 2, 2, 3, 3}, 1, "card", "animal")),
            Map.entry("Pluto", new Rules("cards", new int[] {0, 1, 2, 2, 3, 3, 4}, 1, "card (then discard 1)", null)),
            Map.entry("Titan", new Rules("floaters", new int[] {0, 1, 1, 2, 3, 3, 4}, 1, "floater", "floater")),
            Map.entry("Triton", new Rules("titanium", new int[] {0, 1, 1, 2, 3, 4, 5}, 1, "titanium", null)));

    public final String name;
    public int position = 1;
    public boolean active;
    /** Player ids in the order their colonies went down (slots 0-2). */
    public final List<Integer> owners = new ArrayList<>();
    /** A trade fleet is parked here until the Solar phase. */
    public boolean fleetHere;
    private final int[] track;

    ColonyTile(String name) {
        this.name = name;
        Rules rules = RULES.get(name);
        this.track = rules == null ? null : rules.track().clone();
        this.active = rules == null || rules.activatedBy() == null;
    }

    Rules rules() {
        return RULES.get(name);
    }

    /** Called when a card holding this kind of resource comes into play anywhere. */
    void wake(String resourceKind) {
        Rules rules = rules();
        if (!active && rules != null && resourceKind.equals(rules.activatedBy())) {
            active = true;
        }
    }

    void solarPhase() {
        if (active && position < 6) {
            position++;
        }
        fleetHere = false;
    }

    void built(int playerId) {
        owners.add(playerId);
        position = Math.max(position, owners.size());
    }

    /** {@code step} is where the log says the trade happened; {@code paid} what it gave, to correct the table. */
    void traded(int step, int paid) {
        if (step >= 0 && step <= 6 && track != null && paid > 0) {
            track[step] = paid;
        }
        position = owners.size();
        fleetHere = true;
    }

    Map<String, Object> toMap() {
        Rules rules = rules();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", name);
        out.put("position", position);
        out.put("active", active);
        out.put("owners", List.copyOf(owners));
        out.put("fleetHere", fleetHere);
        if (rules != null) {
            List<Integer> steps = new ArrayList<>();
            for (int v : track) {
                steps.add(v);
            }
            out.put("track", steps);
            out.put("resource", rules.resource());
            out.put("bonus", rules.bonus());
            out.put("bonusResource", rules.bonusResource());
            out.put("activatedBy", rules.activatedBy());
        }
        return out;
    }
}

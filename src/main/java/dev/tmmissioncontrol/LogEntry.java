package dev.tmmissioncontrol;

/** One move in the game log shown on the page: who did what, in which generation. */
public final class LogEntry {
    public final int generation;
    public final int playerId;
    /** card, project, action, corp-action, convert, milestone, award */
    public final String kind;
    public final String name;
    /** Card color (blue, green, red, ...) for card plays; empty otherwise. */
    public final String color;

    public LogEntry(int generation, int playerId, String kind, String name, String color) {
        this.generation = generation;
        this.playerId = playerId;
        this.kind = kind;
        this.name = name;
        this.color = color == null ? "" : color;
    }
}

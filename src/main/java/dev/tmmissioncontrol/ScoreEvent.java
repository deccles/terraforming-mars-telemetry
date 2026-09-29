package dev.tmmissioncontrol;

public final class ScoreEvent {
    public int generation;
    public int playerId;
    public String kind = "";
    public String label = "";
    /** Card, project, or action behind the event; charts group by it. */
    public String source = "";
    public int delta;
    /** Resource tokens added (+) or removed (-) on {@link #source}, for "token" events. */
    public int tokens;
    public String tokenType = "";
    /** What put the tokens there (a played card, or this card's own action). */
    public String cause = "";

    public ScoreEvent(int generation, int playerId, String kind, String label, int delta) {
        this.generation = generation;
        this.playerId = playerId;
        this.kind = kind == null ? "" : kind;
        this.label = label == null ? "" : label;
        this.source = this.label;
        this.delta = delta;
    }
}

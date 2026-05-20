#!/usr/bin/env python3
"""One-shot rewrite of Q7/Q8/Q9 quiz prompts in zero-to-one.v21.json (Ch02-Ch14)
to use distinct scene-anchors instead of duplicating Q1/Q2/Q3's 'documents include ...' list."""

import json
import sys
from pathlib import Path

PATH = Path('/Users/willsoltani/dev/chapterflow-siliconx/book-packages/zero-to-one.v21.json')

REPLACEMENTS = [
    # ---------- CH02 ----------
    ('In a city council work session, the team can take a comfortable path or act on dot-com crash. The documents include milestone chart, red investor comments, lab-access calendar. Which response best fits the specific move here?',
     'A city council work session weighs cautious quiet against a sharper response to dot-com crash. On the whiteboard, the lab-access calendar sits beside red investor comments, with a milestone chart sketched underneath. Which choice actually moves on this cue?'),
    ('In a clinic budget review, the team can take a comfortable path or act on incremental advances. The documents include foam models, bid binder, trace paper. Which response best fits the specific move here?',
     'Inside a clinic budget review, leaders face an easy retreat or a real push toward incremental advances. The slide deck cycles through trace paper, then a bid binder, then foam models. Which option matches this specific signal?'),
    ('In a port authority meeting, the team can take a comfortable path or act on lean flexibility. The documents include traffic dashboard, print deadline board, membership mockup. Which response best fits the specific move here?',
     'Members of a port authority meeting weigh sitting tight against committing to lean flexibility. A printout lists the membership mockup at the top, the print deadline board in the middle, the traffic dashboard at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH03 ----------
    ('In a clinic budget review, the team can take a comfortable path or act on monopoly. The documents include route map, fare spreadsheet, airport slot memo. Which response best fits the specific move here?',
     'A clinic budget review weighs cautious quiet against a sharper response to monopoly. On the whiteboard, the airport slot memo sits beside the fare spreadsheet, with the route map sketched underneath. Which choice actually moves on this cue?'),
    ('In a port authority meeting, the team can take a comfortable path or act on competition. The documents include procurement matrix, audit checklist, security console. Which response best fits the specific move here?',
     'Inside a port authority meeting, leaders face an easy retreat or a real push toward competition. The slide deck cycles through the security console, then the audit checklist, then the procurement matrix. Which option matches this specific signal?'),
    ('In a software roadmap call, the team can take a comfortable path or act on profit. The documents include basil tray, chef order slips, temperature log. Which response best fits the specific move here?',
     'Members of a software roadmap call weigh sitting tight against committing to profit. A printout lists the temperature log at the top, the chef order slips in the middle, the basil tray at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH04 ----------
    ('In a port authority meeting, the team can take a comfortable path or act on rivalry. The documents include competitor menu, tasting spoon, reservation notes. Which response best fits the specific move here?',
     'A port authority meeting weighs cautious quiet against a sharper response to rivalry. On the whiteboard, the reservation notes sit beside the tasting spoon, with the competitor menu sketched underneath. Which choice actually moves on this cue?'),
    ('In a software roadmap call, the team can take a comfortable path or act on competition ideology. The documents include field diagram, aluminum rails, disabled video replay. Which response best fits the specific move here?',
     'Inside a software roadmap call, leaders face an easy retreat or a real push toward competition ideology. The slide deck cycles through the disabled video replay, then the aluminum rails, then the field diagram. Which option matches this specific signal?'),
    ('In a grant committee debate, the team can take a comfortable path or act on imitation. The documents include marble samples, guest complaint cards, floor-plan roll. Which response best fits the specific move here?',
     'Members of a grant committee debate weigh sitting tight against committing to imitation. A printout lists the floor-plan roll at the top, the guest complaint cards in the middle, the marble samples at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH05 ----------
    ('In a software roadmap call, the team can take a comfortable path or act on durability. The documents include parts catalog, cash-flow sheet, supplier contract. Which response best fits the specific move here?',
     'A software roadmap call weighs cautious quiet against a sharper response to durability. On the whiteboard, the supplier contract sits beside the cash-flow sheet, with the parts catalog sketched underneath. Which choice actually moves on this cue?'),
    ('In a grant committee debate, the team can take a comfortable path or act on future cash flow. The documents include scanner crate, referral map, maintenance contract. Which response best fits the specific move here?',
     'Inside a grant committee debate, leaders face an easy retreat or a real push toward future cash flow. The slide deck cycles through the maintenance contract, then the referral map, then the scanner crate. Which option matches this specific signal?'),
    ('In a factory floor review, the team can take a comfortable path or act on endurance. The documents include grant calendar, translation cards, volunteer roster. Which response best fits the specific move here?',
     'Members of a factory floor review weigh sitting tight against committing to endurance. A printout lists the volunteer roster at the top, the translation cards in the middle, the grant calendar at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH06 ----------
    ('In a grant committee debate, the team can take a comfortable path or act on planning. The documents include cancellation slips, OR schedule, pager log. Which response best fits the specific move here?',
     'A grant committee debate weighs cautious quiet against a sharper response to planning. On the whiteboard, the pager log sits beside the OR schedule, with cancellation slips sketched underneath. Which choice actually moves on this cue?'),
    ('In a factory floor review, the team can take a comfortable path or act on luck. The documents include rough-cut timeline, festival calendar, sales-agent list. Which response best fits the specific move here?',
     'Inside a factory floor review, leaders face an easy retreat or a real push toward luck. The slide deck cycles through the sales-agent list, then the festival calendar, then a rough-cut timeline. Which option matches this specific signal?'),
    ('In a school district pilot, the team can take a comfortable path or act on uncertainty. The documents include flood maps, actuarial notes, county permit records. Which response best fits the specific move here?',
     'Members of a school district pilot weigh sitting tight against committing to uncertainty. A printout lists county permit records at the top, the actuarial notes in the middle, the flood maps at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH07 ----------
    ('In a factory floor review, the team can take a comfortable path or act on power law. The documents include pitch memos, return model, red sticky note. Which response best fits the specific move here?',
     'A factory floor review weighs cautious quiet against a sharper response to power law. On the whiteboard, the red sticky note sits beside the return model, with pitch memos sketched underneath. Which choice actually moves on this cue?'),
    ('In a school district pilot, the team can take a comfortable path or act on returns. The documents include lab refrigerator, pipeline grid, trial-cost estimate. Which response best fits the specific move here?',
     'Inside a school district pilot, leaders face an easy retreat or a real push toward returns. The slide deck cycles through the trial-cost estimate, then the pipeline grid, then a lab refrigerator log. Which option matches this specific signal?'),
    ('In a warehouse renewal meeting, the team can take a comfortable path or act on portfolio. The documents include set lists, streaming dashboard, tour budget. Which response best fits the specific move here?',
     'Members of a warehouse renewal meeting weigh sitting tight against committing to portfolio. A printout lists the tour budget at the top, the streaming dashboard in the middle, set lists at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH08 ----------
    ('In a school district pilot, the team can take a comfortable path or act on secrets. The documents include discharge folder, family voicemail list, medication chart. Which response best fits the specific move here?',
     'A school district pilot weighs cautious quiet against a sharper response to secrets. On the whiteboard, the medication chart sits beside the family voicemail list, with the discharge folder sketched underneath. Which choice actually moves on this cue?'),
    ('In a warehouse renewal meeting, the team can take a comfortable path or act on hidden truth. The documents include offcut pile, measuring tape, supplier invoice. Which response best fits the specific move here?',
     'Inside a warehouse renewal meeting, leaders face an easy retreat or a real push toward hidden truth. The slide deck cycles through the supplier invoice, then the measuring tape, then the offcut pile. Which option matches this specific signal?'),
    ('In a research lab planning session, the team can take a comfortable path or act on contrarian. The documents include late-drop forms, timetable printout, advisor notes. Which response best fits the specific move here?',
     'Members of a research lab planning session weigh sitting tight against committing to contrarian. A flip chart lists advisor notes at the top, the timetable printout in the middle, the late-drop forms at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH09 ----------
    ('In a warehouse renewal meeting, the team can take a comfortable path or act on incentives. The documents include equity papers, vesting calendar, cap table draft. Which response best fits the specific move here?',
     'A warehouse renewal meeting weighs cautious quiet against a sharper response to incentives. On the whiteboard, the cap table draft sits beside the vesting calendar, with equity papers sketched underneath. Which choice actually moves on this cue?'),
    ('In a research lab planning session, the team can take a comfortable path or act on foundations. The documents include floor plan, grant letter, role chart. Which response best fits the specific move here?',
     'Inside a research lab planning session, leaders face an easy retreat or a real push toward foundations. The slide deck cycles through the role chart, then the grant letter, then the floor plan. Which option matches this specific signal?'),
    ('In a city council work session, the team can take a comfortable path or act on beginning. The documents include partnership agreement, payroll envelope, prep list. Which response best fits the specific move here?',
     'Members of a city council work session weigh sitting tight against committing to beginning. A printout lists the prep list at the top, the payroll envelope in the middle, the partnership agreement at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH10 ----------
    ('In a research lab planning session, the team can take a comfortable path or act on dense trust. The documents include treatment bay, interview notes, overnight rota. Which response best fits the specific move here?',
     'A research lab planning session weighs cautious quiet against a sharper response to dense trust. On the whiteboard, the overnight rota sits beside interview notes, with the treatment bay schedule sketched underneath. Which choice actually moves on this cue?'),
    ('In a city council work session, the team can take a comfortable path or act on culture. The documents include supply crate, radio schedule, repair kit. Which response best fits the specific move here?',
     'Inside a city council work session, leaders face an easy retreat or a real push toward culture. The slide deck cycles through the repair kit, then the radio schedule, then the supply crate. Which option matches this specific signal?'),
    ('In a clinic budget review, the team can take a comfortable path or act on team. The documents include access badges, migration checklist, status lights. Which response best fits the specific move here?',
     'Members of a clinic budget review weigh sitting tight against committing to team. A printout lists the status lights at the top, the migration checklist in the middle, the access badges at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH11 ----------
    ('In a city council work session, the team can take a comfortable path or act on distribution. The documents include demo laptop, procurement checklist, badge printer. Which response best fits the specific move here?',
     'A city council work session weighs cautious quiet against a sharper response to distribution. On the whiteboard, the badge printer sits beside the procurement checklist, with the demo laptop sketched underneath. Which choice actually moves on this cue?'),
    ('In a clinic budget review, the team can take a comfortable path or act on sales. The documents include moving blankets, order queue, dealer list. Which response best fits the specific move here?',
     'Inside a clinic budget review, leaders face an easy retreat or a real push toward sales. The slide deck cycles through the dealer list, then the order queue, then moving blankets. Which option matches this specific signal?'),
    ('In a port authority meeting, the team can take a comfortable path or act on reach. The documents include tax forms, partner deck, release checklist. Which response best fits the specific move here?',
     'Members of a port authority meeting weigh sitting tight against committing to reach. A printout lists the release checklist at the top, the partner deck in the middle, the tax forms at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH12 ----------
    ('In a clinic budget review, the team can take a comfortable path or act on pattern work. The documents include alert queue, review rubric, model score. Which response best fits the specific move here?',
     'A clinic budget review weighs cautious quiet against a sharper response to pattern work. On the whiteboard, the model score sits beside the review rubric, with the alert queue sketched underneath. Which choice actually moves on this cue?'),
    ('In a port authority meeting, the team can take a comfortable path or act on computer. The documents include topo map, heat anomaly feed, radio log. Which response best fits the specific move here?',
     'Inside a port authority meeting, leaders face an easy retreat or a real push toward computer. The slide deck cycles through the radio log, then the heat anomaly feed, then a topo map. Which option matches this specific signal?'),
    ('In a software roadmap call, the team can take a comfortable path or act on human. The documents include review screen, privilege log, banker boxes. Which response best fits the specific move here?',
     'Members of a software roadmap call weigh sitting tight against committing to human. A printout lists the banker boxes at the top, the privilege log in the middle, the review screen at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH13 ----------
    ('In a port authority meeting, the team can take a comfortable path or act on clean-tech. The documents include boxed inverter, pilot contract, utility email. Which response best fits the specific move here?',
     'A port authority meeting weighs cautious quiet against a sharper response to clean-tech. On the whiteboard, the utility email sits beside the pilot contract, with the boxed inverter sketched underneath. Which choice actually moves on this cue?'),
    ('In a software roadmap call, the team can take a comfortable path or act on timing. The documents include tide chart, charging schematic, grant binder. Which response best fits the specific move here?',
     'Inside a software roadmap call, leaders face an easy retreat or a real push toward timing. The slide deck cycles through the grant binder, then the charging schematic, then the tide chart. Which option matches this specific signal?'),
    ('In a grant committee debate, the team can take a comfortable path or act on scale. The documents include forming machine, throughput log, retailer forecast. Which response best fits the specific move here?',
     'Members of a grant committee debate weigh sitting tight against committing to scale. A printout lists the retailer forecast at the top, the throughput log in the middle, the forming machine at the bottom. Pick the response that fits this exact move.'),

    # ---------- CH14 ----------
    ('In a software roadmap call, the team can take a comfortable path or act on founder paradox. The documents include injector prototype, safety memo, board agenda. Which response best fits the specific move here?',
     'A software roadmap call weighs cautious quiet against a sharper response to founder paradox. On the whiteboard, the board agenda sits beside the safety memo, with the injector prototype sketched underneath. Which choice actually moves on this cue?'),
    ('In a grant committee debate, the team can take a comfortable path or act on intensity. The documents include fabric swatches, finance printout, launch calendar. Which response best fits the specific move here?',
     'Inside a grant committee debate, leaders face an easy retreat or a real push toward intensity. The slide deck cycles through the launch calendar, then the finance printout, then fabric swatches. Which option matches this specific signal?'),
    ('In a factory floor review, the team can take a comfortable path or act on instability. The documents include precision lens, change log, calibration bench. Which response best fits the specific move here?',
     'Members of a factory floor review weigh sitting tight against committing to instability. A printout lists the calibration bench at the top, the change log in the middle, the precision lens at the bottom. Pick the response that fits this exact move.'),
]


def main():
    text = PATH.read_text()

    for i, (old, new) in enumerate(REPLACEMENTS, 1):
        count = text.count(old)
        if count != 1:
            print(f"ERROR replacement #{i}: found {count} matches for: {old[:90]}...")
            sys.exit(1)
        text = text.replace(old, new)

    # Verify JSON validity before writing
    try:
        json.loads(text)
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON invalid after replacement: {e}")
        sys.exit(1)

    PATH.write_text(text)
    print(f"Applied {len(REPLACEMENTS)} replacements; JSON valid.")


if __name__ == '__main__':
    main()

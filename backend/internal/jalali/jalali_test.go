package jalali

import "testing"

func TestKnownDates(t *testing.T) {
	cases := []struct{ gy, gm, gd, jy, jm, jd int }{
		{2024, 3, 20, 1403, 1, 1},
		{2025, 3, 21, 1404, 1, 1},
		{2026, 3, 21, 1405, 1, 1},
		{2025, 3, 20, 1403, 12, 30}, // 1403 is a leap year
		{2025, 9, 23, 1404, 7, 1},
		{2016, 1, 1, 1394, 10, 11},
	}
	for _, c := range cases {
		jy, jm, jd := ToJalali(c.gy, c.gm, c.gd)
		if jy != c.jy || jm != c.jm || jd != c.jd {
			t.Errorf("ToJalali(%d-%d-%d) = %d/%d/%d, want %d/%d/%d", c.gy, c.gm, c.gd, jy, jm, jd, c.jy, c.jm, c.jd)
		}
		gy, gm, gd := ToGregorian(c.jy, c.jm, c.jd)
		if gy != c.gy || gm != c.gm || gd != c.gd {
			t.Errorf("ToGregorian(%d/%d/%d) = %d-%d-%d", c.jy, c.jm, c.jd, gy, gm, gd)
		}
	}
}

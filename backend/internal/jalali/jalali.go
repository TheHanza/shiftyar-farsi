// Package jalali converts between the Jalali (Solar Hijri) and Gregorian
// calendars. It is a port of the jalaali-js algorithm (MIT) by Behrang
// Noruzi Niya, valid for Jalali years -61 through 3177.
package jalali

var breaks = []int{-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
	1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178}

func div(a, b int) int { return a / b }
func mod(a, b int) int { return a - (a/b)*b }

// jalCal returns whether jy is a leap year (0 means leap), the Gregorian
// year in which jy starts, and the March day of Farvardin 1st.
func jalCal(jy int, withoutLeap bool) (leap, gy, march int) {
	bl := len(breaks)
	gy = jy + 621
	leapJ := -14
	jp := breaks[0]
	var jump int
	if jy < jp || jy >= breaks[bl-1] {
		panic("jalali: year out of range")
	}
	for i := 1; i < bl; i++ {
		jm := breaks[i]
		jump = jm - jp
		if jy < jm {
			break
		}
		leapJ = leapJ + div(jump, 33)*8 + div(mod(jump, 33), 4)
		jp = jm
	}
	n := jy - jp
	leapJ = leapJ + div(n, 33)*8 + div(mod(n, 33)+3, 4)
	if mod(jump, 33) == 4 && jump-n == 4 {
		leapJ++
	}
	leapG := div(gy, 4) - div((div(gy, 100)+1)*3, 4) - 150
	march = 20 + leapJ - leapG
	if !withoutLeap {
		if jump-n < 6 {
			n = n - jump + div(jump+4, 33)*33
		}
		leap = mod(mod(n+1, 33)-1, 4)
		if leap == -1 {
			leap = 4
		}
	}
	return
}

func g2d(gy, gm, gd int) int {
	d := div((gy+div(gm-8, 6)+100100)*1461, 4) + div(153*mod(gm+9, 12)+2, 5) + gd - 34840408
	return d - div(div(gy+100100+div(gm-8, 6), 100)*3, 4) + 752
}

func d2g(jdn int) (gy, gm, gd int) {
	j := 4*jdn + 139361631
	j = j + div(div(4*jdn+183187720, 146097)*3, 4)*4 - 3908
	i := div(mod(j, 1461), 4)*5 + 308
	gd = div(mod(i, 153), 5) + 1
	gm = mod(div(i, 153), 12) + 1
	gy = div(j, 1461) - 100100 + div(8-gm, 6)
	return
}

func j2d(jy, jm, jd int) int {
	_, gy, march := jalCal(jy, true)
	return g2d(gy, 3, march) + (jm-1)*31 - div(jm, 7)*(jm-7) + jd - 1
}

func d2j(jdn int) (jy, jm, jd int) {
	gy, _, _ := d2g(jdn)
	jy = gy - 621
	leap, _, march := jalCal(jy, false)
	k := jdn - g2d(gy, 3, march)
	if k >= 0 {
		if k <= 185 {
			return jy, 1 + div(k, 31), mod(k, 31) + 1
		}
		k -= 186
	} else {
		jy--
		k += 179
		if leap == 1 {
			k++
		}
	}
	return jy, 7 + div(k, 30), mod(k, 30) + 1
}

// ToJalali converts a Gregorian date to Jalali.
func ToJalali(gy, gm, gd int) (jy, jm, jd int) { return d2j(g2d(gy, gm, gd)) }

// ToGregorian converts a Jalali date to Gregorian.
func ToGregorian(jy, jm, jd int) (gy, gm, gd int) { return d2g(j2d(jy, jm, jd)) }
